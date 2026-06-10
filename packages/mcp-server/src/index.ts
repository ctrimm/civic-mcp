#!/usr/bin/env node
/**
 * @civic-mcp/mcp-server
 *
 * Bridges civic-mcp adapters to any MCP-compatible AI client
 * (Claude Desktop, Cursor, Cline, …) over stdio JSON-RPC 2.0.
 *
 * How it works
 * ────────────
 * 1. On startup, scans the adapters/ directory and loads every adapter that
 *    has a valid manifest.json and an adapter.ts/js default export.
 * 2. Advertises all adapter tools via tools/list, namespaced as
 *    "{adapterId}.{toolName}" (e.g. "gov.ssa.retirement.estimate_retirement_benefit").
 * 3. On tools/call, launches a Playwright Chromium page, runs the adapter's
 *    execute() function with a full SandboxContext, and returns the result.
 * 4. When an adapter calls waitForHuman():
 *      CIVIC_MCP_HEADED=1  → headed browser + readline prompt on stderr
 *      (default, headless) → local HTTP server on a random port; URL printed
 *                            to stderr; tool call blocks until user clicks "Done"
 *
 * Claude Desktop config (~/.claude/claude_desktop_config.json):
 * ──────────────────────────────────────────────────────────────
 * {
 *   "mcpServers": {
 *     "civic-mcp": {
 *       "command": "npx",
 *       "args": ["tsx", "/path/to/civic-mcp/packages/mcp-server/src/index.ts"],
 *       "env": { "CIVIC_MCP_HEADED": "1" }   ← add for interactive CAPTCHA flows
 *     }
 *   }
 * }
 *
 * Cursor (~/.cursor/mcp.json):
 * ────────────────────────────
 * {
 *   "mcpServers": {
 *     "civic-mcp": {
 *       "command": "npx",
 *       "args": ["tsx", "/path/to/civic-mcp/packages/mcp-server/src/index.ts"]
 *     }
 *   }
 * }
 */

import { Server }                  from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport }    from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema,
         CallToolRequestSchema }   from '@modelcontextprotocol/sdk/types.js';
import { chromium, type Browser }  from 'playwright';
import { resolve }                 from 'node:path';
import { fileURLToPath }           from 'node:url';

import { loadAdapters, flattenTools, findTool, type LoadedTool } from './adapter-loader.js';
import { createSandboxForTool }    from './sandbox.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const __dirname   = fileURLToPath(new URL('.', import.meta.url));
const ADAPTERS_DIR = process.env['CIVIC_MCP_ADAPTERS_DIR']
  ?? resolve(__dirname, '../../../adapters');

const HEADED        = process.env['CIVIC_MCP_HEADED'] === '1';
const TOOL_TIMEOUT  = parseInt(process.env['CIVIC_MCP_TIMEOUT'] ?? '60000', 10);

// ---------------------------------------------------------------------------
// Bootstrap: load adapters
// ---------------------------------------------------------------------------

process.stderr.write(`[civic-mcp] Loading adapters from: ${ADAPTERS_DIR}\n`);

let tools: LoadedTool[];
try {
  const adapters = await loadAdapters(ADAPTERS_DIR);
  tools = flattenTools(adapters);
  process.stderr.write(
    `[civic-mcp] Loaded ${adapters.length} adapter(s), ${tools.length} tool(s):\n` +
    tools.map((t) => `  • ${t.mcpName}`).join('\n') + '\n\n',
  );
} catch (err) {
  process.stderr.write(`[civic-mcp] Fatal: failed to load adapters — ${err}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Browser (one instance for the server lifetime)
// ---------------------------------------------------------------------------

let browser: Browser | undefined;

async function getBrowser(): Promise<Browser> {
  if (browser) return browser;
  browser = await chromium.launch({
    headless: !HEADED,
    args: ['--enable-experimental-web-platform-features'],
  });
  process.stderr.write(`[civic-mcp] Chromium launched (${HEADED ? 'headed' : 'headless'})\n`);
  return browser;
}

// Clean up on exit
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    process.stderr.write(`\n[civic-mcp] Shutting down…\n`);
    await browser?.close();
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'civic-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// ── tools/list ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name:        t.mcpName,
    description: buildDescription(t),
    inputSchema: t.tool.inputSchema,
  })),
}));

function buildDescription(t: LoadedTool): string {
  // Prefix every tool description with adapter metadata so the AI has context
  const prefix = `[${t.manifest.name}] `;
  return prefix + t.tool.description;
}

// ── tools/call ──────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  let found: LoadedTool;
  try {
    found = findTool(tools, name);
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }

  const b = await getBrowser();
  const bCtx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await bCtx.newPage();

  const { context, dispose } = await createSandboxForTool(page, found.manifest, {
    timeout: TOOL_TIMEOUT,
    headed: HEADED,
  });

  process.stderr.write(`[civic-mcp] Calling ${name}…\n`);

  let result;
  try {
    result = await found.tool.execute(args as Record<string, unknown>, context);
  } catch (err) {
    await dispose();
    await bCtx.close();
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[civic-mcp] Tool "${name}" threw: ${msg}\n`);
    return {
      content: [{ type: 'text', text: `Error executing tool "${name}": ${msg}` }],
      isError: true,
    };
  }

  await dispose();
  await bCtx.close();

  if (!result.success) {
    process.stderr.write(`[civic-mcp] Tool "${name}" returned error: ${result.error}\n`);
    return {
      content: [{ type: 'text', text: `Tool error: ${result.error}` }],
      isError: true,
    };
  }

  process.stderr.write(`[civic-mcp] Tool "${name}" succeeded.\n`);

  const text = JSON.stringify(result.data, null, 2);
  return {
    content: [{ type: 'text', text }],
    // structuredContent is the 2025-11-25 MCP spec addition — pass through raw data
    ...(result.data && typeof result.data === 'object'
      ? { structuredContent: result.data as Record<string, unknown> }
      : {}),
  };
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('[civic-mcp] MCP server ready — listening on stdio\n');
