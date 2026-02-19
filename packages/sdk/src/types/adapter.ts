/**
 * The shape of a JavaScript adapter module (adapter.ts / adapter.js).
 * Declarative-only adapters use DeclarativeTool[] instead.
 */

import type { SandboxContext } from './sandbox.js';

// ---------------------------------------------------------------------------
// JSON Schema subset used for tool input definitions
// ---------------------------------------------------------------------------

export type JSONSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

export interface JSONSchemaProperty {
  type: JSONSchemaType;
  description?: string;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

// ---------------------------------------------------------------------------
// Tool execution result
// ---------------------------------------------------------------------------

export interface ToolSuccess<T = Record<string, unknown>> {
  success: true;
  data: T;
}

export interface ToolError {
  success: false;
  error: string;
  /** Machine-readable error code */
  code?:
    | 'NAVIGATION_FAILED'
    | 'SELECTOR_NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'SITE_CHANGED'
    | 'AUTH_REQUIRED'
    | 'RATE_LIMITED'
    | 'UNKNOWN';
}

export type ToolResult<T = Record<string, unknown>> = ToolSuccess<T> | ToolError;

// ---------------------------------------------------------------------------
// Adapter tool definition
// ---------------------------------------------------------------------------

export interface AdapterTool<
  TParams extends Record<string, unknown> = Record<string, unknown>,
  TResult extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Must match the tool name in manifest.json */
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  execute(params: TParams, context: SandboxContext): Promise<ToolResult<TResult>>;
}

// ---------------------------------------------------------------------------
// Adapter module (default export of adapter.ts)
// ---------------------------------------------------------------------------

export interface AdapterModule {
  /** Must match the id in manifest.json */
  id: string;

  /** Called once when the adapter loads on a matching page */
  init?(context: SandboxContext): Promise<void>;

  tools: AdapterTool[];
}
