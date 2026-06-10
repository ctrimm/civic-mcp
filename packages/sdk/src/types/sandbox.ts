/**
 * The sandboxed context object passed to JavaScript adapters.
 * This is the only interface adapters may use — no direct DOM or chrome.* access.
 */

// ---------------------------------------------------------------------------
// Page API
// ---------------------------------------------------------------------------

export interface NavigateOptions {
  /** CSS selector to wait for after navigation completes */
  waitForSelector?: string;
  /** Timeout in milliseconds (default: 10_000) */
  timeout?: number;
}

export interface WaitForOptions {
  /** Timeout in milliseconds (default: 10_000) */
  timeout?: number;
  /** Poll interval in milliseconds (default: 250) */
  interval?: number;
}

export interface FillOptions {
  /** Delay in ms between keystrokes to simulate human typing (default: 0) */
  typeDelay?: number;
  /** Clear existing value before filling (default: true) */
  clear?: boolean;
}

export interface SelectOptions {
  /** Match by option text instead of value attribute */
  byText?: boolean;
}

export interface ClickOptions {
  /** Wait for navigation to complete after click */
  waitForNavigation?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface WaitForHumanOptions {
  /** Human-readable instruction shown in the extension popup (default: 'Manual step required') */
  prompt?: string;
  /** Maximum milliseconds to wait before timing out (default: 300_000 = 5 minutes) */
  timeout?: number;
}

export interface PageAPI {
  /** Navigate to a URL. Must be within the adapter's declared domains. */
  navigate(url: string, options?: NavigateOptions): Promise<void>;

  /** Fill a form field identified by a CSS selector. */
  fillField(selector: string, value: string, options?: FillOptions): Promise<void>;

  /** Select an option in a <select> element. */
  selectOption(selector: string, value: string, options?: SelectOptions): Promise<void>;

  /** Click an element. */
  click(selector: string, options?: ClickOptions): Promise<void>;

  /** Return the visible text content of an element, or null if not found. */
  getText(selector: string): Promise<string | null>;

  /** Return the value attribute of a form input, or null if not found. */
  getValue(selector: string): Promise<string | null>;

  /** Return whether an element exists in the DOM. */
  exists(selector: string): Promise<boolean>;

  /** Wait until a selector appears in the DOM. */
  waitForSelector(selector: string, options?: WaitForOptions): Promise<void>;

  /** Wait until a selector disappears from the DOM. */
  waitForSelectorGone(selector: string, options?: WaitForOptions): Promise<void>;

  /** Return the current page URL. */
  currentUrl(): string;

  /**
   * Suspend adapter execution and prompt the user to complete a manual step
   * (e.g. solve a CAPTCHA, answer a security question, or handle 2FA).
   *
   * In the extension the popup surfaces `options.prompt` and waits for the
   * user to click "Done" before the adapter continues. In the test harness
   * the prompt is printed to the terminal and execution waits for Enter; in
   * headless CI a {@link HumanRequiredError} is thrown so the test is marked
   * skipped rather than failed.
   */
  waitForHuman(options?: WaitForHumanOptions): Promise<void>;
}

// ---------------------------------------------------------------------------
// Storage API
// ---------------------------------------------------------------------------

export interface StorageAPI {
  /** Get a value by key from plugin-scoped storage. */
  get<T = unknown>(key: string): Promise<T | null>;

  /** Set a value by key. Total plugin storage is capped at 100 KB. */
  set<T = unknown>(key: string, value: T): Promise<void>;

  /** Delete a stored key. */
  delete(key: string): Promise<void>;

  /** Clear all storage for this plugin. */
  clear(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Notify API
// ---------------------------------------------------------------------------

export interface NotifyAPI {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

// ---------------------------------------------------------------------------
// Utils API
// ---------------------------------------------------------------------------

export interface UtilsAPI {
  /** Pause execution for `ms` milliseconds. */
  sleep(ms: number): Promise<void>;

  /**
   * Parse a date string into a JS Date. Handles common US government
   * formats: MM/DD/YYYY, YYYY-MM-DD, "Month D, YYYY".
   */
  parseDate(value: string): Date | null;

  /**
   * Format a number as a US dollar currency string.
   * e.g. formatCurrency(1234.5) → "$1,234.50"
   */
  formatCurrency(amount: number): string;

  /** Strip non-numeric characters from a string and return as number. */
  parseAmount(value: string): number | null;
}

// ---------------------------------------------------------------------------
// Full sandbox context
// ---------------------------------------------------------------------------

export interface SandboxContext {
  page: PageAPI;
  storage: StorageAPI;
  notify: NotifyAPI;
  utils: UtilsAPI;
}
