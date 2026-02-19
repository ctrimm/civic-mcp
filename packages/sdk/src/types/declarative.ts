/**
 * Declarative (JSON-only) tool definition format.
 * No JavaScript required — the core engine interprets these and generates
 * WebMCP tools automatically.
 */

// ---------------------------------------------------------------------------
// Input definitions
// ---------------------------------------------------------------------------

export type InputType = 'text' | 'number' | 'boolean' | 'select' | 'date' | 'email' | 'tel';

export interface SelectOption {
  label: string;
  value: string;
}

export interface InputDef {
  /** CSS selector for the form field */
  selector: string;
  type: InputType;
  /** For type === 'select', the list of valid options */
  options?: SelectOption[];
  /** Whether this input is required */
  required?: boolean;
  /** Human-readable description for the MCP tool schema */
  description?: string;
  /** Default value if the parameter is not provided */
  default?: string | number | boolean;
}

// ---------------------------------------------------------------------------
// Navigation definition
// ---------------------------------------------------------------------------

export interface NavigationDef {
  /** URL to navigate to. Must be within the adapter's declared domains. */
  url: string;
  /** Wait for this selector to appear before proceeding */
  waitForSelector?: string;
  /** Click this selector before interacting (e.g. "Get Started" button) */
  clickFirst?: string;
}

// ---------------------------------------------------------------------------
// Submit definition
// ---------------------------------------------------------------------------

export interface SubmitDef {
  /** CSS selector for the submit button or element to click */
  selector: string;
  /** Selector to wait for after submission (e.g. a results container) */
  waitForSelector?: string;
}

// ---------------------------------------------------------------------------
// Output definitions
// ---------------------------------------------------------------------------

export type OutputType = 'text' | 'number' | 'boolean' | 'html' | 'url' | 'date';

export interface OutputDef {
  /** CSS selector for the element containing the output value */
  selector: string;
  type: OutputType;
  /** Optional: attribute to read (defaults to textContent) */
  attribute?: string;
  /** Whether null output is acceptable (default: false) */
  optional?: boolean;
}

// ---------------------------------------------------------------------------
// Full declarative tool definition
// ---------------------------------------------------------------------------

export interface DeclarativeTool {
  name: string;
  description: string;
  navigation: NavigationDef;
  inputs: Record<string, InputDef>;
  submit: SubmitDef;
  output: Record<string, OutputDef>;
}

// ---------------------------------------------------------------------------
// Declarative adapter manifest extension
// ---------------------------------------------------------------------------

export interface DeclarativeAdapterConfig {
  id: string;
  declarative: true;
  tools: DeclarativeTool[];
}
