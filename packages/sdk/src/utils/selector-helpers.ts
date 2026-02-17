/**
 * DOM selector utilities shared by the extension core and testing harness.
 * Pure functions — no side effects, no DOM access.
 */

/**
 * Build a scoped storage key for a plugin.
 * Ensures all plugin storage keys are properly namespaced.
 */
export function pluginStorageKey(pluginId: string, key: string): string {
  return `civic-mcp:plugin:${pluginId}:${key}`;
}

/**
 * Given a plugin ID and a tool name, return the namespaced WebMCP tool name.
 * Prevents name collisions between plugins.
 * e.g. ("gov.colorado.peak", "check_eligibility") → "gov.colorado.peak.check_eligibility"
 */
export function namespacedToolName(pluginId: string, toolName: string): string {
  return `${pluginId}.${toolName}`;
}

/**
 * Check whether a URL is within a list of allowed domains.
 * Domain entries may be bare hostnames ("peak.my.site.com") or
 * include a path prefix ("colorado.gov/peak").
 */
export function isUrlAllowed(url: string, domains: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return domains.some((domain) => {
    // Domain may have a path prefix (e.g. "colorado.gov/peak")
    const [host, ...pathParts] = domain.split('/');
    const pathPrefix = pathParts.length > 0 ? '/' + pathParts.join('/') : '';

    if (parsed.hostname !== host) return false;
    if (pathPrefix && !parsed.pathname.startsWith(pathPrefix)) return false;
    return true;
  });
}

/**
 * Extract the byte size of a JSON-serialisable value.
 * Used to enforce the 100 KB plugin storage cap.
 */
export function jsonByteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/** Maximum allowed plugin storage in bytes (100 KB). */
export const MAX_STORAGE_BYTES = 100 * 1024;

/**
 * Sanitize a string value before filling a form field.
 * Strips null bytes and control characters that could cause unexpected behaviour.
 */
export function sanitizeFieldValue(value: string): string {
  // Remove null bytes and ASCII control characters (0x00–0x1F, 0x7F)
  // but preserve common whitespace: tab (0x09), newline (0x0A), CR (0x0D)
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Convert a tool execution duration in milliseconds to a human-readable label.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}
