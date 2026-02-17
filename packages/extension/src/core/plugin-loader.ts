/**
 * Plugin loader — runs as a content script on every page.
 *
 * For each installed + enabled adapter whose domains match the current
 * hostname, loads the adapter and registers its tools via the WebMCP API
 * (navigator.modelContext.registerTool).
 */

import type { AdapterManifest, AdapterModule, DeclarativeAdapterConfig, DeclarativeTool, ToolResult } from '@civic-mcp/sdk';
import { isUrlAllowed, namespacedToolName } from '@civic-mcp/sdk';
import { getInstalledPlugins, isPluginEnabled } from './registry-client.js';
import { createSandboxContext, executePluginCode } from './sandbox.js';

// ---------------------------------------------------------------------------
// WebMCP type augmentation
// ---------------------------------------------------------------------------

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  execute(params: Record<string, unknown>): Promise<unknown>;
}

declare global {
  interface Navigator {
    modelContext?: {
      registerTool(tool: MCPToolDefinition): void;
    };
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function initPluginLoader(): Promise<void> {
  if (!navigator.modelContext) {
    // WebMCP not available on this browser — silent exit
    return;
  }

  const currentUrl = window.location.href;
  let currentHostname: string;

  try {
    currentHostname = new URL(currentUrl).hostname;
  } catch {
    return;
  }

  const plugins = await getInstalledPlugins();
  const matching = plugins.filter(
    (p) => p.enabled && isUrlAllowed(currentUrl, p.manifest.domains),
  );

  for (const plugin of matching) {
    try {
      await loadPlugin(plugin.manifest, plugin.code);
    } catch (err) {
      console.error(`[Civic-MCP] Failed to load adapter "${plugin.id}":`, err);
    }
  }

  if (matching.length > 0) {
    console.info(
      `[Civic-MCP] Loaded ${matching.length} adapter(s) on ${currentHostname}:`,
      matching.map((p) => p.id).join(', '),
    );
  }
}

// ---------------------------------------------------------------------------
// Load a single plugin
// ---------------------------------------------------------------------------

async function loadPlugin(manifest: AdapterManifest, code?: string): Promise<void> {
  if (manifest.declarative) {
    // Declarative adapters are bundled as declarative.json inside the code field
    if (!code) throw new Error(`Declarative adapter "${manifest.id}" has no config`);
    const config = JSON.parse(code) as DeclarativeAdapterConfig;
    loadDeclarativePlugin(manifest, config);
  } else {
    if (!code) throw new Error(`JS adapter "${manifest.id}" has no source code`);
    await loadJavaScriptPlugin(manifest, code);
  }
}

// ---------------------------------------------------------------------------
// Declarative plugin loader
// ---------------------------------------------------------------------------

function loadDeclarativePlugin(manifest: AdapterManifest, config: DeclarativeAdapterConfig): void {
  const context = createSandboxContext(manifest);

  for (const tool of config.tools) {
    registerDeclarativeTool(manifest, tool, context);
  }
}

function registerDeclarativeTool(
  manifest: AdapterManifest,
  tool: DeclarativeTool,
  context: ReturnType<typeof createSandboxContext>,
): void {
  const inputProperties: Record<string, object> = {};
  const required: string[] = [];

  for (const [param, def] of Object.entries(tool.inputs)) {
    inputProperties[param] = {
      type: def.type === 'boolean' ? 'boolean' : def.type === 'number' ? 'number' : 'string',
      description: def.description ?? `Value for ${param}`,
      ...(def.options ? { enum: def.options.map((o) => o.value) } : {}),
    };
    if (def.required !== false) required.push(param);
  }

  navigator.modelContext!.registerTool({
    name: namespacedToolName(manifest.id, tool.name),
    description: tool.description,
    inputSchema: { type: 'object', properties: inputProperties, required },
    async execute(params): Promise<ToolResult> {
      try {
        await context.page.navigate(tool.navigation.url, {
          waitForSelector: tool.navigation.waitForSelector,
        });

        if (tool.navigation.clickFirst) {
          await context.page.click(tool.navigation.clickFirst);
        }

        for (const [param, def] of Object.entries(tool.inputs)) {
          const value = params[param];
          if (value === undefined || value === null) continue;
          await context.page.fillField(def.selector, String(value));
        }

        await context.page.click(tool.submit.selector, {
          waitForNavigation: !!tool.submit.waitForSelector,
        });

        if (tool.submit.waitForSelector) {
          await context.page.waitForSelector(tool.submit.waitForSelector);
        }

        const output: Record<string, unknown> = {};
        for (const [key, def] of Object.entries(tool.output)) {
          const el = document.querySelector(def.selector);
          if (!el) {
            if (!def.optional) {
              throw new Error(`Output selector not found: "${def.selector}"`);
            }
            output[key] = null;
            continue;
          }
          const raw = def.attribute ? el.getAttribute(def.attribute) : el.textContent?.trim();
          output[key] = coerceOutput(raw ?? null, def.type);
        }

        return { success: true, data: output };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          code: 'UNKNOWN',
        };
      }
    },
  });
}

// ---------------------------------------------------------------------------
// JavaScript plugin loader
// ---------------------------------------------------------------------------

async function loadJavaScriptPlugin(manifest: AdapterManifest, code: string): Promise<void> {
  const adapter: AdapterModule = executePluginCode(code);
  const context = createSandboxContext(manifest);

  if (adapter.init) {
    await adapter.init(context);
  }

  for (const tool of adapter.tools) {
    navigator.modelContext!.registerTool({
      name: namespacedToolName(manifest.id, tool.name),
      description: tool.description,
      inputSchema: tool.inputSchema,
      async execute(params): Promise<ToolResult> {
        try {
          return await tool.execute(params, context);
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            code: 'UNKNOWN',
          };
        }
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coerceOutput(raw: string | null, type: string): unknown {
  if (raw === null) return null;
  switch (type) {
    case 'number':
      return parseFloat(raw.replace(/[,$]/g, '')) || null;
    case 'boolean':
      return /yes|true|eligible|approved/i.test(raw);
    case 'date':
      return raw;
    default:
      return raw;
  }
}
