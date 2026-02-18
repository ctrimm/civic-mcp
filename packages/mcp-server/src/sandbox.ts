/**
 * Playwright-backed SandboxContext for the MCP server.
 *
 * Key differences from the testing harness:
 *   - StorageAPI: persists to ~/.civic-mcp/storage/{adapterId}.json
 *   - NotifyAPI: writes to stderr (never stdout — that's reserved for JSON-RPC)
 *   - waitForHuman (headless): opens a local HTTP server, prints the URL to
 *     stderr so the operator (or Claude Desktop's log panel) can see it, then
 *     waits for the user to click "Done" in their browser.
 *   - waitForHuman (headed): same readline approach as the test harness.
 */

import { type Page } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:http';
import type {
  SandboxContext,
  PageAPI,
  StorageAPI,
  NotifyAPI,
  UtilsAPI,
  AdapterManifest,
  NavigateOptions,
  WaitForOptions,
  FillOptions,
  SelectOptions,
  ClickOptions,
  WaitForHumanOptions,
} from '@civic-mcp/sdk';
import { isUrlAllowed, sanitizeFieldValue, jsonByteSize, MAX_STORAGE_BYTES } from '@civic-mcp/sdk';

// ---------------------------------------------------------------------------
// File-system StorageAPI
// ---------------------------------------------------------------------------
// Stores each adapter's data as a single JSON file at:
//   ~/.civic-mcp/storage/{adapterId}.json
// This matches chrome.storage.local semantics (key/value, same quota).

const STORAGE_ROOT = join(homedir(), '.civic-mcp', 'storage');

async function ensureStorageDir() {
  await mkdir(STORAGE_ROOT, { recursive: true });
}

function storageFile(adapterId: string): string {
  // Sanitise id — only allow alphanumeric, dots, and hyphens
  const safe = adapterId.replace(/[^a-zA-Z0-9.\-]/g, '_');
  return join(STORAGE_ROOT, `${safe}.json`);
}

async function readStore(adapterId: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(storageFile(adapterId), 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeStore(adapterId: string, store: Record<string, unknown>): Promise<void> {
  await ensureStorageDir();
  await writeFile(storageFile(adapterId), JSON.stringify(store, null, 2), 'utf-8');
}

function makeStorageAPI(adapterId: string): StorageAPI {
  return {
    async get<T>(key: string): Promise<T | null> {
      const store = await readStore(adapterId);
      return (store[key] as T) ?? null;
    },

    async set<T>(key: string, value: T): Promise<void> {
      const store = await readStore(adapterId);
      // Enforce same 100KB quota as the extension
      const existingBytes = Object.entries(store)
        .filter(([k]) => k !== key)
        .reduce((sum, [, v]) => sum + jsonByteSize(v), 0);
      const newBytes = jsonByteSize(value);
      if (existingBytes + newBytes > MAX_STORAGE_BYTES) {
        throw new Error(`Storage quota exceeded for adapter "${adapterId}" (max ${MAX_STORAGE_BYTES / 1024} KB)`);
      }
      store[key] = value;
      await writeStore(adapterId, store);
    },

    async delete(key: string): Promise<void> {
      const store = await readStore(adapterId);
      delete store[key];
      await writeStore(adapterId, store);
    },

    async clear(): Promise<void> {
      await writeStore(adapterId, {});
    },
  };
}

// ---------------------------------------------------------------------------
// Human-in-the-loop helpers
// ---------------------------------------------------------------------------

/**
 * In headless mode: spin up a throwaway HTTP server on a random port, print
 * the URL to stderr, serve a minimal HTML page with the prompt and a "Done"
 * button, wait for the POST /done, then shut down and return.
 *
 * This keeps the MCP tool call active and blocking until the human completes
 * the step — no client retry required.
 */
async function waitForHumanViaHttp(prompt: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/done') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        server.close();
        resolve();
        return;
      }

      // Serve the HTML page for any GET
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Civic-MCP — Human Step Required</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 24px; }
    h1 { font-size: 1.4rem; color: #1d4ed8; }
    pre { background: #f1f5f9; border-radius: 8px; padding: 16px; white-space: pre-wrap; font-size: .9rem; line-height: 1.6; }
    button { background: #16a34a; color: #fff; border: none; border-radius: 8px; padding: 12px 32px;
             font-size: 1rem; cursor: pointer; margin-top: 24px; }
    button:hover { background: #15803d; }
    p.note { color: #64748b; font-size: .85rem; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Civic-MCP — Human Step Required</h1>
  <p>The AI agent has paused and is waiting for you to complete a step in the browser:</p>
  <pre>${escapeHtml(prompt)}</pre>
  <button id="done" onclick="complete()">Done — continue</button>
  <p class="note">Clicking "Done" resumes the agent. The browser tab can be closed after.</p>
  <script>
    function complete() {
      document.getElementById('done').disabled = true;
      document.getElementById('done').textContent = 'Resuming…';
      fetch('/done', { method: 'POST' }).catch(() => {});
    }
  </script>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;
      process.stderr.write(
        `\n[civic-mcp] Human step required — open this URL in your browser:\n  ${url}\n` +
          `  Prompt: ${prompt.split('\n')[0]}\n\n`,
      );
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error(`waitForHuman timed out after ${timeoutMs / 1_000}s — "${prompt}"`));
    }, timeoutMs);

    server.on('close', () => clearTimeout(timer));
  });
}

/** In headed mode: print the prompt and wait for Enter (same as test harness). */
async function waitForHumanViaReadline(prompt: string): Promise<void> {
  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  await new Promise<void>((resolve) => {
    rl.question(`\n[civic-mcp] Human step required: ${prompt}\nPress Enter when done... `, () => {
      rl.close();
      resolve();
    });
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// PageAPI (Playwright-backed)
// ---------------------------------------------------------------------------

function makePageAPI(pw: Page, manifest: AdapterManifest, defaultTimeout: number, headed: boolean): PageAPI {
  return {
    async navigate(url: string, opts: NavigateOptions = {}): Promise<void> {
      if (!isUrlAllowed(url, manifest.domains)) {
        throw new Error(
          `Adapter "${manifest.id}" is not allowed to navigate to "${url}". ` +
            `Allowed domains: ${manifest.domains.join(', ')}`,
        );
      }
      await pw.goto(url, { timeout: opts.timeout ?? defaultTimeout, waitUntil: 'domcontentloaded' });
      if (opts.waitForSelector) {
        await pw.waitForSelector(opts.waitForSelector, { timeout: opts.timeout ?? defaultTimeout });
      }
    },

    async fillField(selector: string, value: string, _opts: FillOptions = {}): Promise<void> {
      await pw.fill(selector, sanitizeFieldValue(value), { timeout: defaultTimeout });
    },

    async selectOption(selector: string, value: string, opts: SelectOptions = {}): Promise<void> {
      if (opts.byText) {
        await pw.selectOption(selector, { label: value }, { timeout: defaultTimeout });
      } else {
        await pw.selectOption(selector, value, { timeout: defaultTimeout });
      }
    },

    async click(selector: string, opts: ClickOptions = {}): Promise<void> {
      await pw.click(selector, { timeout: defaultTimeout });
      if (opts.waitForNavigation) {
        await pw.waitForLoadState('domcontentloaded', {
          timeout: opts.timeout ?? defaultTimeout,
        });
      }
    },

    async getText(selector: string): Promise<string | null> {
      try {
        return await pw.textContent(selector, { timeout: 5_000 });
      } catch {
        return null;
      }
    },

    async getValue(selector: string): Promise<string | null> {
      try {
        return await pw.inputValue(selector, { timeout: 5_000 });
      } catch {
        return null;
      }
    },

    async exists(selector: string): Promise<boolean> {
      return (await pw.locator(selector).count()) > 0;
    },

    async waitForSelector(selector: string, opts: WaitForOptions = {}): Promise<void> {
      await pw.waitForSelector(selector, { timeout: opts.timeout ?? defaultTimeout });
    },

    async waitForSelectorGone(selector: string, opts: WaitForOptions = {}): Promise<void> {
      await pw.waitForSelector(selector, {
        state: 'hidden',
        timeout: opts.timeout ?? defaultTimeout,
      });
    },

    currentUrl(): string {
      return pw.url();
    },

    async waitForHuman(opts: WaitForHumanOptions = {}): Promise<void> {
      const prompt = opts.prompt ?? 'Manual step required — complete the action in the browser window';
      const timeout = opts.timeout ?? 10 * 60 * 1_000;

      if (headed) {
        await waitForHumanViaReadline(prompt);
      } else {
        await waitForHumanViaHttp(prompt, timeout);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// NotifyAPI — writes to stderr only (stdout is reserved for MCP JSON-RPC)
// ---------------------------------------------------------------------------

function makeNotifyAPI(adapterId: string): NotifyAPI {
  const prefix = `[civic-mcp:${adapterId}]`;
  return {
    info:  (msg) => process.stderr.write(`${prefix} ℹ  ${msg}\n`),
    warn:  (msg) => process.stderr.write(`${prefix} ⚠  ${msg}\n`),
    error: (msg) => process.stderr.write(`${prefix} ✖  ${msg}\n`),
  };
}

// ---------------------------------------------------------------------------
// UtilsAPI
// ---------------------------------------------------------------------------

const UTILS: UtilsAPI = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),

  parseDate(value) {
    let d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    const mdy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) {
      d = new Date(`${mdy[3]}-${mdy[1]!.padStart(2, '0')}-${mdy[2]!.padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  },

  parseAmount(value) {
    const n = parseFloat(value.replace(/[$,\s]/g, ''));
    return isNaN(n) ? null : n;
  },
};

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export interface SandboxHandle {
  context: SandboxContext;
  /** Call when the tool call is done — closes the Playwright page */
  dispose(): Promise<void>;
}

export async function createSandboxForTool(
  pw: Page,
  manifest: AdapterManifest,
  opts: { timeout?: number; headed?: boolean } = {},
): Promise<SandboxHandle> {
  const timeout = opts.timeout ?? 30_000;
  const headed = opts.headed ?? false;

  const context: SandboxContext = {
    page:    makePageAPI(pw, manifest, timeout, headed),
    storage: makeStorageAPI(manifest.id),
    notify:  makeNotifyAPI(manifest.id),
    utils:   UTILS,
  };

  return {
    context,
    async dispose() {
      await pw.close();
    },
  };
}
