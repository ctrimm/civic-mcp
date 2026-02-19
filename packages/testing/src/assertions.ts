/**
 * Custom vitest matchers for adapter test assertions.
 *
 * Usage:
 *   import { expect } from 'vitest';
 *   import '@civic-mcp/testing/assertions';
 *
 * Or extend manually:
 *   import { matchers } from '@civic-mcp/testing';
 *   expect.extend(matchers);
 */

import type { ToolResult } from '@civic-mcp/sdk';

export const matchers = {
  /**
   * Assert that a ToolResult was successful and optionally contains expected data fields.
   *
   * @example
   * expect(result).toBeToolSuccess({ eligible: true });
   */
  toBeToolSuccess(received: ToolResult, expectedData?: Record<string, unknown>) {
    if (!received.success) {
      return {
        pass: false,
        message: () =>
          `Expected tool result to be successful, but got error: "${(received as { error: string }).error}"`,
      };
    }

    if (expectedData) {
      const data = (received as { data: Record<string, unknown> }).data;
      const mismatches: string[] = [];

      for (const [key, expectedValue] of Object.entries(expectedData)) {
        const actual = data[key];
        if (actual !== expectedValue) {
          mismatches.push(`  ${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}`);
        }
      }

      if (mismatches.length > 0) {
        return {
          pass: false,
          message: () =>
            `Tool result succeeded but data did not match:\n${mismatches.join('\n')}`,
        };
      }
    }

    return { pass: true, message: () => 'Expected tool result not to be successful' };
  },

  /**
   * Assert that a ToolResult failed with an optional error code.
   *
   * @example
   * expect(result).toBeToolError('SELECTOR_NOT_FOUND');
   */
  toBeToolError(received: ToolResult, expectedCode?: string) {
    if (received.success) {
      return {
        pass: false,
        message: () => `Expected tool result to be an error, but it succeeded`,
      };
    }

    if (expectedCode) {
      const actual = (received as { code?: string }).code;
      if (actual !== expectedCode) {
        return {
          pass: false,
          message: () => `Expected error code "${expectedCode}", got "${actual ?? 'undefined'}"`,
        };
      }
    }

    return { pass: true, message: () => 'Expected tool result not to be an error' };
  },

  /**
   * Assert that a ToolResult has a specific data field.
   *
   * @example
   * expect(result).toHaveToolData('eligible');
   */
  toHaveToolData(received: ToolResult, key: string) {
    if (!received.success) {
      return {
        pass: false,
        message: () =>
          `Expected tool result to have data key "${key}", but result was an error: "${(received as { error: string }).error}"`,
      };
    }

    const data = (received as { data: Record<string, unknown> }).data;
    const has = key in data && data[key] !== null && data[key] !== undefined;

    return {
      pass: has,
      message: () =>
        has
          ? `Expected tool result not to have data key "${key}"`
          : `Expected tool result to have data key "${key}", but it was ${JSON.stringify(data[key])}. ` +
            `Available keys: ${Object.keys(data).join(', ')}`,
    };
  },
};

// Bring vitest into the compilation so the module augmentation below is valid.
// This import is type-only and erased at compile time.
import type {} from 'vitest';

// Auto-extend vitest expect if called as a side-effect import
declare module 'vitest' {
  interface Assertion {
    toBeToolSuccess(expectedData?: Record<string, unknown>): void;
    toBeToolError(expectedCode?: string): void;
    toHaveToolData(key: string): void;
  }
}
