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
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve }                 from 'node:path';
import { fileURLToPath }           from 'node:url';
import type { ApplicantProfile }   from '@civic-mcp/sdk';

import { loadAdapters, flattenTools, findTool, type LoadedTool } from './adapter-loader.js';
import { createSandboxForTool }    from './sandbox.js';
import {
  resolveIdentity,
  loadApplicantProfile,
  saveApplicantProfile,
  makeIdentityAPI,
} from './identity.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const __dirname   = fileURLToPath(new URL('.', import.meta.url));
const ADAPTERS_DIR = process.env['CIVIC_MCP_ADAPTERS_DIR']
  ?? resolve(__dirname, '../../../adapters');

const HEADED        = process.env['CIVIC_MCP_HEADED'] === '1';
const TOOL_TIMEOUT  = parseInt(process.env['CIVIC_MCP_TIMEOUT'] ?? '60000', 10);
const ALLOW_WRITE   = process.env['CIVIC_MCP_ALLOW_WRITE'] === '1';

// Active portable identity (browser profile + applicant data + adapter storage).
// Select with CIVIC_MCP_IDENTITY; see docs/identity.md for the on-disk layout.
const identity = await resolveIdentity();
process.stderr.write(`[civic-mcp] Identity: "${identity.name}" (${identity.dir})\n`);

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
// Browser — one persistent context for the server lifetime, backed by the
// identity's browser-profile dir, so logins survive across tool calls AND
// across server restarts. Each adapter keeps its own page open between
// calls so multi-step flows (call 1: start application, call 2: continue)
// retain state.
// ---------------------------------------------------------------------------

let browserContext: BrowserContext | undefined;
const adapterPages = new Map<string, Page>();

async function getBrowserContext(): Promise<BrowserContext> {
  if (browserContext) return browserContext;
  browserContext = await chromium.launchPersistentContext(identity.browserProfileDir, {
    headless: !HEADED,
    viewport: { width: 1280, height: 800 },
    args: ['--enable-experimental-web-platform-features'],
  });
  process.stderr.write(
    `[civic-mcp] Chromium launched (${HEADED ? 'headed' : 'headless'}, ` +
    `profile: ${identity.browserProfileDir})\n`,
  );
  return browserContext;
}

/** Get (or create) the long-lived page for an adapter. */
async function getAdapterPage(adapterId: string): Promise<Page> {
  const existing = adapterPages.get(adapterId);
  if (existing && !existing.isClosed()) return existing;

  const ctx = await getBrowserContext();
  const page = await ctx.newPage();
  adapterPages.set(adapterId, page);
  return page;
}

/** Close all adapter pages and the browser context (cookies persist on disk). */
async function closeBrowserSession(): Promise<void> {
  for (const page of adapterPages.values()) {
    if (!page.isClosed()) await page.close().catch(() => {});
  }
  adapterPages.clear();
  await browserContext?.close().catch(() => {});
  browserContext = undefined;
}

// Clean up on exit
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    process.stderr.write(`\n[civic-mcp] Shutting down…\n`);
    await closeBrowserSession();
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
  tools: [
    ...BUILTIN_TOOLS,
    ...tools.map((t) => {
      const readOnly = securityLevelFor(t) === 'read_only';
      return {
        name:        t.mcpName,
        description: buildDescription(t),
        inputSchema: t.tool.inputSchema,
        annotations: {
          title: `${t.manifest.name}: ${t.tool.name}`,
          readOnlyHint: readOnly,
          // Write tools submit real data to real government systems —
          // clients should treat them as consequential and confirm with the user.
          destructiveHint: !readOnly,
          openWorldHint: true,
        },
      };
    }),
  ],
}));

function buildDescription(t: LoadedTool): string {
  // Prefix every tool description with adapter metadata so the AI has context
  const prefix = `[${t.manifest.name}] `;
  const suffix = securityLevelFor(t) === 'write'
    ? ' (WRITE tool: fills and/or submits real forms. Requires CIVIC_MCP_ALLOW_WRITE=1 on the server.)'
    : '';
  return prefix + t.tool.description + suffix;
}

/**
 * Security level declared in the adapter manifest for this tool.
 * Defaults to 'write' (the conservative choice) when undeclared.
 */
function securityLevelFor(t: LoadedTool): 'read_only' | 'write' {
  const summary = t.manifest.tools.find((s) => s.name === t.tool.name);
  return summary?.securityLevel ?? 'write';
}

// ── built-in server tools (identity management, session control) ───────────

const BUILTIN_TOOLS = [
  {
    name: 'identity_get_profile',
    description:
      `Read the applicant profile saved in the active civic-mcp identity ` +
      `("${identity.name}"). Adapters use this data to prefill government forms. ` +
      `Returns null if no profile has been saved yet.`,
    inputSchema: { type: 'object', properties: {} },
    annotations: { title: 'Identity: get applicant profile', readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'identity_set_profile',
    description:
      `Save (replace) the applicant profile for the active civic-mcp identity ` +
      `("${identity.name}"). Stored encrypted on the local machine with an OS-keychain key. ` +
      `Never include a full SSN — only ssnLast4 is accepted.`,
    inputSchema: {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          description:
            'ApplicantProfile object: firstName, lastName, dateOfBirth (ISO), ssnLast4, ' +
            'phone, email, preferredLanguage, address {street, unit, city, state, zip}, ' +
            'household {size, hasElderlyMember, hasDisabledMember, members[]}, ' +
            'income {monthlyGross, monthlyRent, monthlyUtilities, monthlyChildCare, monthlyMedicalCosts}',
        },
      },
      required: ['profile'],
    },
    annotations: { title: 'Identity: save applicant profile', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'session_reset',
    description:
      'Close all open browser pages for the current civic-mcp session. ' +
      'Saved logins (cookies) persist on disk unless clearCookies is true.',
    inputSchema: {
      type: 'object',
      properties: {
        clearCookies: {
          type: 'boolean',
          description: 'Also clear cookies/logins stored in the identity browser profile',
        },
      },
    },
    annotations: { title: 'Session: reset browser', readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
];

async function callBuiltinTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean } | null> {
  switch (name) {
    case 'identity_get_profile': {
      const profile = await loadApplicantProfile(identity);
      return { content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }] };
    }

    case 'identity_set_profile': {
      const profile = args['profile'];
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        return {
          content: [{ type: 'text', text: 'Error: "profile" must be an object' }],
          isError: true,
        };
      }
      await saveApplicantProfile(identity, profile as ApplicantProfile);
      return {
        content: [{ type: 'text', text: `Applicant profile saved for identity "${identity.name}".` }],
      };
    }

    case 'session_reset': {
      const clearCookies = args['clearCookies'] === true;
      if (clearCookies && browserContext) {
        await browserContext.clearCookies();
      }
      await closeBrowserSession();
      return {
        content: [{
          type: 'text',
          text: clearCookies
            ? 'Browser session closed and cookies cleared.'
            : 'Browser session closed. Saved logins persist on disk.',
        }],
      };
    }

    default:
      return null; // not a builtin
  }
}

// ── tools/call ──────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  // Built-in tools first (identity + session management)
  try {
    const builtin = await callBuiltinTool(name, args as Record<string, unknown>);
    if (builtin) return builtin;
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }

  let found: LoadedTool;
  try {
    found = findTool(tools, name);
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }

  // Gate write tools behind an explicit operator opt-in. MCP annotations are
  // advisory only — a client that ignores them must still not be able to
  // submit applications unless the person running the server allowed it.
  if (securityLevelFor(found) === 'write' && !ALLOW_WRITE) {
    return {
      content: [{
        type: 'text',
        text:
          `Tool "${name}" is a WRITE tool — it fills and/or submits real forms on a government website. ` +
          `Write tools are disabled by default. To enable them, restart the civic-mcp server with ` +
          `CIVIC_MCP_ALLOW_WRITE=1 in its environment, and review the data before submission.`,
      }],
      isError: true,
    };
  }

  // Long-lived page per adapter: state and logins survive across calls
  const page = await getAdapterPage(found.adapterId);

  const context = createSandboxForTool(page, found.manifest, {
    timeout: TOOL_TIMEOUT,
    headed: HEADED,
    storageDir: identity.storageDir,
    identity: makeIdentityAPI(identity),
  });

  process.stderr.write(`[civic-mcp] Calling ${name}…\n`);

  let result;
  try {
    result = await found.tool.execute(args as Record<string, unknown>, context);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[civic-mcp] Tool "${name}" threw: ${msg}\n`);
    return {
      content: [{ type: 'text', text: `Error executing tool "${name}": ${msg}` }],
      isError: true,
    };
  }

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
