/**
 * AdapterTestHarness — launches a Playwright Chromium browser, loads the
 * adapter module, and executes tools against the live site.
 *
 * The harness creates a Node-side mock of SandboxContext that maps
 * context.page.* calls to Playwright page interactions. This means adapters
 * run in Node.js but drive a real Chrome instance — no extension required.
 */

import { chromium, type Browser, type Page } from 'playwright';
import type {
  AdapterModule,
  AdapterTool,
  SandboxContext,
  PageAPI,
  StorageAPI,
  NotifyAPI,
  UtilsAPI,
  ToolResult,
  NavigateOptions,
  WaitForOptions,
  FillOptions,
  SelectOptions,
  ClickOptions,
} from '@civic-mcp/sdk';
import { isUrlAllowed } from '@civic-mcp/sdk';
import type { AdapterManifest } from '@civic-mcp/sdk';

export interface HarnessOptions {
  /** Absolute path to the adapter.ts / adapter.js file */
  adapterPath: string;
  /** Absolute path to the manifest.json file */
  manifestPath: string;
  /** Run browser headed (default: false / headless) */
  headed?: boolean;
  /** Timeout for page operations in ms (default: 15_000) */
  timeout?: number;
}

export interface AdapterTestHarness {
  /** Execute a named tool with given parameters. Returns the tool result. */
  testTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<ToolResult>;

  /** Get the Playwright Page object for manual assertions */
  page(): Page;

  /** Tear down the browser after tests */
  close(): Promise<void>;
}

/**
 * Create a test harness. Call this once per test suite (beforeAll),
 * close() it in afterAll.
 *
 * @example
 * const harness = createHarness({ adapterPath: './adapter.ts', manifestPath: './manifest.json' });
 * afterAll(() => harness.close());
 *
 * test('check_eligibility', async () => {
 *   const result = await harness.testTool('check_eligibility', { householdSize: 3, monthlyIncome: 2500 });
 *   expect(result.success).toBe(true);
 * });
 */
export function createHarness(options: HarnessOptions): AdapterTestHarness {
  let browser: Browser | undefined;
  let playwrightPage: Page | undefined;
  let adapter: AdapterModule | undefined;
  let manifest: AdapterManifest | undefined;
  let context: SandboxContext | undefined;

  // Lazy init so the browser only launches when the first testTool() call happens
  async function init() {
    if (browser) return;

    const { pathToFileURL } = await import('node:url');

    // Load manifest
    const manifestMod = await import(pathToFileURL(options.manifestPath).href, {
      assert: { type: 'json' },
    });
    manifest = manifestMod.default as AdapterManifest;

    // Load adapter module (TypeScript adapters must be pre-built to JS first,
    // or this harness can be used with ts-node / tsx in the test runner)
    const adapterMod = await import(pathToFileURL(options.adapterPath).href);
    adapter = (adapterMod.default ?? adapterMod) as AdapterModule;

    if (!adapter?.tools?.length) {
      throw new Error(`Adapter at "${options.adapterPath}" has no tools`);
    }

    browser = await chromium.launch({
      headless: !(options.headed ?? process.env['CIVIC_MCP_HEADED'] === '1'),
      // Enable WebMCP experimental flag
      args: ['--enable-experimental-web-platform-features'],
    });

    const browserContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    playwrightPage = await browserContext.newPage();

    // Build the sandbox context backed by Playwright
    context = buildSandboxContext(playwrightPage, manifest, options.timeout ?? 15_000);

    // Run adapter init if present
    if (adapter.init) {
      await adapter.init(context);
    }
  }

  return {
    async testTool(toolName, params) {
      await init();

      const tool = adapter!.tools.find((t: AdapterTool) => t.name === toolName);
      if (!tool) {
        throw new Error(
          `Tool "${toolName}" not found in adapter "${adapter!.id}". ` +
            `Available: ${adapter!.tools.map((t: AdapterTool) => t.name).join(', ')}`,
        );
      }

      return tool.execute(params, context!);
    },

    page() {
      if (!playwrightPage) {
        throw new Error('Harness not initialised — call testTool() first');
      }
      return playwrightPage;
    },

    async close() {
      await browser?.close();
      browser = undefined;
      playwrightPage = undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Playwright-backed SandboxContext
// ---------------------------------------------------------------------------

function buildSandboxContext(
  pw: Page,
  manifest: AdapterManifest,
  defaultTimeout: number,
): SandboxContext {
  const storage = new Map<string, unknown>();

  const pageAPI: PageAPI = {
    async navigate(url: string, opts: NavigateOptions = {}): Promise<void> {
      if (!isUrlAllowed(url, manifest.domains)) {
        throw new Error(`URL not in allowed domains: ${url}`);
      }
      await pw.goto(url, { timeout: opts.timeout ?? defaultTimeout, waitUntil: 'domcontentloaded' });
      if (opts.waitForSelector) {
        await pw.waitForSelector(opts.waitForSelector, { timeout: opts.timeout ?? defaultTimeout });
      }
    },

    async fillField(selector: string, value: string, _opts: FillOptions = {}): Promise<void> {
      await pw.fill(selector, value, { timeout: defaultTimeout });
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
        await pw.waitForLoadState('domcontentloaded', { timeout: opts.timeout ?? defaultTimeout });
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
  };

  const storageAPI: StorageAPI = {
    async get<T>(key: string): Promise<T | null> {
      return (storage.get(key) as T) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      storage.set(key, value);
    },
    async delete(key: string): Promise<void> {
      storage.delete(key);
    },
    async clear(): Promise<void> {
      storage.clear();
    },
  };

  const notifyAPI: NotifyAPI = {
    info: (msg) => console.info(`[adapter:info] ${msg}`),
    warn: (msg) => console.warn(`[adapter:warn] ${msg}`),
    error: (msg) => console.error(`[adapter:error] ${msg}`),
  };

  const utilsAPI: UtilsAPI = {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    parseDate(value) {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    },
    formatCurrency(amount) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    },
    parseAmount(value) {
      const n = parseFloat(value.replace(/[$,\s]/g, ''));
      return isNaN(n) ? null : n;
    },
  };

  return { page: pageAPI, storage: storageAPI, notify: notifyAPI, utils: utilsAPI };
}
