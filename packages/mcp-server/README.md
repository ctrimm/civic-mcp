# @civic-mcp/mcp-server

Bridges civic-mcp adapters to Claude Desktop, Cursor, and any other
[MCP](https://modelcontextprotocol.io)-compatible AI client over stdio JSON-RPC 2.0.

Every adapter in `adapters/` is automatically discovered and exposed as a named
MCP tool — no configuration required.

---

## How it works

1. On startup the server scans the `adapters/` directory and loads every adapter
   that has a `manifest.json` and an `adapter.ts` / `adapter.js`.
2. Each adapter tool is advertised as `{adapterId}.{toolName}`, e.g.
   `gov.ssa.retirement.estimate_retirement_benefit`.
3. When a tool is called the server launches a Playwright Chromium browser page,
   runs the adapter's `execute()` function, and returns the result as JSON.
4. If the adapter calls `waitForHuman()` (e.g. for a reCAPTCHA):
   - **`CIVIC_MCP_HEADED=1`** — the browser window opens visibly; the terminal
     prints a prompt and waits for Enter.
   - **headless (default)** — a local HTTP page opens at a random port; the URL
     is printed to stderr; the tool call blocks until the user clicks **Done**.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| pnpm | ≥ 9 |
| Chromium (Playwright) | installed automatically |

Install dependencies and Chromium from the repo root:

```bash
pnpm install
pnpm --filter @civic-mcp/mcp-server exec playwright install chromium
```

---

## Connecting to Claude Desktop

### Step 1 — find the config file

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Create the file if it doesn't exist.

### Step 2 — add the server entry

Replace `/absolute/path/to/civic-mcp` with the real path on your machine
(`pwd` from the repo root will give it to you).

**Recommended — run TypeScript source directly (no build step needed):**

```json
{
  "mcpServers": {
    "civic-mcp": {
      "command": "node",
      "args": [
        "--import", "tsx",
        "/absolute/path/to/civic-mcp/packages/mcp-server/src/index.ts"
      ]
    }
  }
}
```

**With `CIVIC_MCP_HEADED=1` (required for tools that need a human to solve a CAPTCHA):**

```json
{
  "mcpServers": {
    "civic-mcp": {
      "command": "node",
      "args": [
        "--import", "tsx",
        "/absolute/path/to/civic-mcp/packages/mcp-server/src/index.ts"
      ],
      "env": {
        "CIVIC_MCP_HEADED": "1"
      }
    }
  }
}
```

**Alternative — pre-built (faster cold start):**

```bash
# From repo root
pnpm --filter @civic-mcp/mcp-server run build
```

```json
{
  "mcpServers": {
    "civic-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/civic-mcp/packages/mcp-server/dist/index.js"
      ]
    }
  }
}
```

### Step 3 — restart Claude Desktop

Fully quit and relaunch Claude Desktop (⌘Q / File → Exit, then reopen).
The tools will appear in the tool picker automatically.

---

## Connecting to Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "civic-mcp": {
      "command": "node",
      "args": [
        "--import", "tsx",
        "/absolute/path/to/civic-mcp/packages/mcp-server/src/index.ts"
      ]
    }
  }
}
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `CIVIC_MCP_HEADED` | `0` | Set to `1` to run Chromium in a visible window. Required for any tool that calls `waitForHuman()` (e.g. reCAPTCHA flows). |
| `CIVIC_MCP_ADAPTERS_DIR` | `adapters/` (repo root) | Absolute path to an alternative adapters directory. |
| `CIVIC_MCP_TIMEOUT` | `60000` | Maximum milliseconds a single tool call may run before being aborted. |

---

## Available tools (current adapters)

| MCP tool name | Description |
|---|---|
| `gov.ssa.retirement.estimate_retirement_benefit` | Estimate monthly Social Security benefits using the SSA Quick Calculator. No login required. |
| `gov.ssa.retirement.start_retirement_application` | Begin a retirement benefits application on SSA.gov. Pauses for human CAPTCHA verification. |

Tools are auto-discovered — any new adapter dropped into `adapters/` is
picked up automatically on the next server restart.

---

## Troubleshooting

**"Adapters directory not found"**
The server couldn't find the `adapters/` directory. Set `CIVIC_MCP_ADAPTERS_DIR`
to the absolute path of your `adapters/` folder.

**"Cannot find package 'tsx'"**
Run `pnpm install` from the repo root, or install tsx globally:
```bash
npm install -g tsx
```

**Chromium not found**
```bash
pnpm --filter @civic-mcp/mcp-server exec playwright install chromium
```

**Tools don't appear in Claude Desktop**
- Confirm the path in the config is absolute, not relative.
- Check that Node.js ≥ 18 is on your `PATH` (the same one Claude Desktop uses).
- Open the Claude Desktop developer console to see stderr output from the server.
  On macOS: **Help → Show MCP Log** (or `~/Library/Logs/Claude/mcp*.log`).

**Tool times out**
Increase the timeout via the environment variable:
```json
"env": { "CIVIC_MCP_TIMEOUT": "120000" }
```
