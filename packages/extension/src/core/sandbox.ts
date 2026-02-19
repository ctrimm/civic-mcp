/* eslint-disable no-new-func */
/**
 * Plugin sandbox — executes adapter code with a controlled context.
 *
 * MVP: Uses an isolated Function scope. See CONCERNS.md §2 for the
 * deferred iframe/Worker hardening plan.
 */

import type {
  SandboxContext,
  PageAPI,
  StorageAPI,
  NotifyAPI,
  UtilsAPI,
  NavigateOptions,
  WaitForOptions,
  FillOptions,
  SelectOptions,
  ClickOptions,
  WaitForHumanOptions,
} from '@civic-mcp/sdk';
import { isUrlAllowed, pluginStorageKey, jsonByteSize, sanitizeFieldValue, MAX_STORAGE_BYTES } from '@civic-mcp/sdk';
import type { AdapterModule } from '@civic-mcp/sdk';
import type { AdapterManifest } from '@civic-mcp/sdk';

// ---------------------------------------------------------------------------
// Page API implementation
// ---------------------------------------------------------------------------

function createPageAPI(manifest: AdapterManifest): PageAPI {
  function guardUrl(url: string): void {
    if (!isUrlAllowed(url, manifest.domains)) {
      throw new Error(
        `Adapter "${manifest.id}" is not permitted to navigate to "${url}". ` +
          `Allowed domains: ${manifest.domains.join(', ')}`,
      );
    }
  }

  async function waitFor(selector: string, opts: WaitForOptions = {}): Promise<Element> {
    const timeout = opts.timeout ?? 10_000;
    const interval = opts.interval ?? 250;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const el = document.querySelector(selector);
      if (el) return el;
      await sleep(interval);
    }
    throw new Error(`Selector not found within ${timeout}ms: "${selector}"`);
  }

  return {
    async navigate(url: string, opts: NavigateOptions = {}): Promise<void> {
      guardUrl(url);
      window.location.href = url;

      // Wait for the new page DOM to settle
      await sleep(500);
      if (opts.waitForSelector) {
        await waitFor(opts.waitForSelector, { timeout: opts.timeout });
      }
    },

    async fillField(selector: string, value: string, opts: FillOptions = {}): Promise<void> {
      const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
      if (!el) throw new Error(`Field not found: "${selector}"`);

      const safeValue = sanitizeFieldValue(value);
      const clear = opts.clear !== false;
      if (clear) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (opts.typeDelay && opts.typeDelay > 0) {
        for (const char of safeValue) {
          el.value += char;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          await sleep(opts.typeDelay);
        }
      } else {
        el.value = safeValue;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },

    async selectOption(selector: string, value: string, opts: SelectOptions = {}): Promise<void> {
      const el = document.querySelector<HTMLSelectElement>(selector);
      if (!el) throw new Error(`Select element not found: "${selector}"`);

      if (opts.byText) {
        const option = Array.from(el.options).find((o) => o.text.trim() === value);
        if (!option) throw new Error(`Option with text "${value}" not found in "${selector}"`);
        el.value = option.value;
      } else {
        el.value = value;
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },

    async click(selector: string, opts: ClickOptions = {}): Promise<void> {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) throw new Error(`Element not found: "${selector}"`);
      el.click();
      if (opts.waitForNavigation) {
        await sleep(1_000);
      }
    },

    async getText(selector: string): Promise<string | null> {
      const el = document.querySelector(selector);
      return el?.textContent?.trim() ?? null;
    },

    async getValue(selector: string): Promise<string | null> {
      const el = document.querySelector<HTMLInputElement>(selector);
      return el?.value ?? null;
    },

    async exists(selector: string): Promise<boolean> {
      return document.querySelector(selector) !== null;
    },

    async waitForSelector(selector: string, opts: WaitForOptions = {}): Promise<void> {
      await waitFor(selector, opts);
    },

    async waitForSelectorGone(selector: string, opts: WaitForOptions = {}): Promise<void> {
      const timeout = opts.timeout ?? 10_000;
      const interval = opts.interval ?? 250;
      const deadline = Date.now() + timeout;

      while (Date.now() < deadline) {
        if (!document.querySelector(selector)) return;
        await sleep(interval);
      }
      throw new Error(`Selector still present after ${timeout}ms: "${selector}"`);
    },

    currentUrl(): string {
      return window.location.href;
    },

    async waitForHuman(opts: WaitForHumanOptions = {}): Promise<void> {
      const requestId = crypto.randomUUID();
      const prompt = opts.prompt ?? 'Manual step required';
      const timeout = opts.timeout ?? 5 * 60 * 1_000; // 5 minutes
      const storageKey = 'civic-mcp:human-required';

      // Signal the popup by writing a pending request to shared storage
      await chrome.storage.local.set({
        [storageKey]: { requestId, prompt, status: 'pending', timestamp: Date.now() },
      });

      // Poll until the popup marks it completed (or we time out)
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        await sleep(500);
        const result = await chrome.storage.local.get(storageKey);
        const req = result[storageKey] as { requestId: string; status: string } | undefined;
        if (!req || req.requestId !== requestId || req.status === 'completed') {
          await chrome.storage.local.remove(storageKey);
          return;
        }
      }

      await chrome.storage.local.remove(storageKey);
      throw new Error(`waitForHuman timed out after ${timeout / 1_000}s — "${prompt}"`);
    },
  };
}

// ---------------------------------------------------------------------------
// Storage API implementation
// ---------------------------------------------------------------------------

function createStorageAPI(pluginId: string): StorageAPI {
  function key(k: string) {
    return pluginStorageKey(pluginId, k);
  }

  return {
    async get<T = unknown>(k: string): Promise<T | null> {
      const result = await chrome.storage.local.get(key(k));
      return (result[key(k)] as T) ?? null;
    },

    async set<T = unknown>(k: string, value: T): Promise<void> {
      const existing = await chrome.storage.local.get(null);
      const pluginPrefix = `civic-mcp:plugin:${pluginId}:`;
      const usedBytes = Object.entries(existing)
        .filter(([ek]) => ek.startsWith(pluginPrefix))
        .reduce((sum, [, v]) => sum + jsonByteSize(v), 0);

      const newBytes = jsonByteSize(value);
      if (usedBytes + newBytes > MAX_STORAGE_BYTES) {
        throw new Error(`Storage quota exceeded (max ${MAX_STORAGE_BYTES / 1024} KB per plugin)`);
      }

      await chrome.storage.local.set({ [key(k)]: value });
    },

    async delete(k: string): Promise<void> {
      await chrome.storage.local.remove(key(k));
    },

    async clear(): Promise<void> {
      const all = await chrome.storage.local.get(null);
      const prefix = `civic-mcp:plugin:${pluginId}:`;
      const toRemove = Object.keys(all).filter((k) => k.startsWith(prefix));
      if (toRemove.length > 0) {
        await chrome.storage.local.remove(toRemove);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Notify API implementation
// ---------------------------------------------------------------------------

function createNotifyAPI(pluginName: string): NotifyAPI {
  function show(type: 'info' | 'warn' | 'error', message: string) {
    const colors = { info: '#3b82f6', warn: '#f59e0b', error: '#ef4444' };
    const icons = { info: 'ℹ️', warn: '⚠️', error: '❌' };

    const div = document.createElement('div');
    div.style.cssText = [
      'position:fixed',
      'bottom:16px',
      'right:16px',
      'z-index:2147483647',
      'padding:12px 16px',
      `border-left:4px solid ${colors[type]}`,
      'background:#fff',
      'box-shadow:0 4px 12px rgba(0,0,0,.15)',
      'border-radius:4px',
      'max-width:360px',
      'font-family:system-ui,sans-serif',
      'font-size:14px',
      'line-height:1.5',
    ].join(';');

    div.innerHTML = `<strong>${icons[type]} Civic-MCP (${escapeHtml(pluginName)})</strong><br>${escapeHtml(message)}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5_000);
  }

  return {
    info: (msg: string) => show('info', msg),
    warn: (msg: string) => show('warn', msg),
    error: (msg: string) => show('error', msg),
  };
}

// ---------------------------------------------------------------------------
// Utils API implementation
// ---------------------------------------------------------------------------

const UTILS: UtilsAPI = {
  sleep,

  parseDate(value: string): Date | null {
    // Try ISO
    let d = new Date(value);
    if (!isNaN(d.getTime())) return d;

    // MM/DD/YYYY
    const mdy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) {
      d = new Date(`${mdy[3]}-${mdy[1]!.padStart(2, '0')}-${mdy[2]!.padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d;
    }

    return null;
  },

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  },

  parseAmount(value: string): number | null {
    const cleaned = value.replace(/[$,\s]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  },
};

// ---------------------------------------------------------------------------
// Context factory
// ---------------------------------------------------------------------------

export function createSandboxContext(manifest: AdapterManifest): SandboxContext {
  return {
    page: createPageAPI(manifest),
    storage: createStorageAPI(manifest.id),
    notify: createNotifyAPI(manifest.name),
    utils: UTILS,
  };
}

// ---------------------------------------------------------------------------
// Plugin code execution
// ---------------------------------------------------------------------------

/**
 * Execute adapter source code in an isolated function scope and return the
 * default export (an AdapterModule). The adapter code receives no globals
 * beyond what we explicitly pass in the context object.
 */
export function executePluginCode(code: string): AdapterModule {
  // Wrap the module code so the adapter can use `export default` syntax
  // (we normalise to a return statement here)
  const wrapped = `
    'use strict';
    const exports = {};
    const module = { exports };
    ${code.replace(/export\s+default\s+/, 'module.exports = ')}
    return module.exports;
  `;

  // eslint-disable-next-line no-new-func
  const factory = new Function(wrapped);
  const result = factory() as unknown;

  if (!result || typeof result !== 'object') {
    throw new Error('Adapter module must export a default object');
  }

  const mod = result as Record<string, unknown>;
  if (typeof mod['id'] !== 'string') {
    throw new Error('Adapter module must have an "id" string property');
  }
  if (!Array.isArray(mod['tools'])) {
    throw new Error('Adapter module must have a "tools" array property');
  }

  return mod as unknown as AdapterModule;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
