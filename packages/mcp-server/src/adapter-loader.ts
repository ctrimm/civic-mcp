import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AdapterModule, AdapterManifest, AdapterTool } from '@civic-mcp/sdk';

export interface LoadedAdapter {
  manifest: AdapterManifest;
  module: AdapterModule;
}

export interface LoadedTool {
  adapterId: string;
  manifest: AdapterManifest;
  /** Fully-qualified MCP tool name: "gov.california.getcalfresh.check_eligibility" */
  mcpName: string;
  tool: AdapterTool;
}

/**
 * Scan the adapters directory and load every valid adapter.
 * An adapter directory is valid if it contains a manifest.json and an
 * adapter.ts / adapter.js (or dist/adapter.js) with a default-exported
 * AdapterModule.
 */
export async function loadAdapters(adaptersDir: string): Promise<LoadedAdapter[]> {
  let entries;
  try {
    entries = await readdir(adaptersDir, { withFileTypes: true });
  } catch {
    throw new Error(`Adapters directory not found: ${adaptersDir}`);
  }

  const results: LoadedAdapter[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const adapterDir = join(adaptersDir, entry.name);
    try {
      const loaded = await loadOneAdapter(adapterDir);
      if (loaded) results.push(loaded);
    } catch (err) {
      // Log to stderr — does not interfere with stdio JSON-RPC on stdout
      process.stderr.write(
        `[civic-mcp] Skipping "${entry.name}": ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  return results;
}

async function loadOneAdapter(adapterDir: string): Promise<LoadedAdapter | null> {
  // Must have a manifest
  let manifestText: string;
  try {
    manifestText = await readFile(join(adapterDir, 'manifest.json'), 'utf-8');
  } catch {
    return null; // Not an adapter directory
  }

  const manifest = JSON.parse(manifestText) as AdapterManifest;

  // Try loading order: pre-built JS > TypeScript source
  const candidates = [
    join(adapterDir, 'dist', 'adapter.js'),
    join(adapterDir, 'adapter.js'),
    join(adapterDir, 'adapter.ts'),
  ];

  for (const candidate of candidates) {
    try {
      const mod = await import(pathToFileURL(candidate).href);
      const adapterModule = (mod.default ?? mod) as AdapterModule;
      if (adapterModule?.tools?.length) {
        return { manifest, module: adapterModule };
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

/**
 * Flatten all loaded adapters into a single list of MCP-named tools.
 * Tool name format: "{adapterId}.{toolName}"
 * Example: "gov.california.getcalfresh.check_eligibility"
 */
export function flattenTools(adapters: LoadedAdapter[]): LoadedTool[] {
  const tools: LoadedTool[] = [];

  for (const { manifest, module } of adapters) {
    for (const tool of module.tools) {
      tools.push({
        adapterId: manifest.id,
        manifest,
        mcpName: `${manifest.id}.${tool.name}`,
        tool,
      });
    }
  }

  return tools;
}

/** Find a tool by its MCP name. Throws if not found. */
export function findTool(tools: LoadedTool[], mcpName: string): LoadedTool {
  const found = tools.find((t) => t.mcpName === mcpName);
  if (!found) {
    throw new Error(
      `Unknown tool: "${mcpName}". Available: ${tools.map((t) => t.mcpName).join(', ')}`,
    );
  }
  return found;
}
