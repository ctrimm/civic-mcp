# @civic-mcp/cli

Command-line tool for creating, developing, testing, validating, and publishing civic-mcp adapters.

## Install (global)

```bash
pnpm add -g @civic-mcp/cli
```

Or run directly from the monorepo (from the repo root):

```bash
pnpm build:cli             # compile once
node packages/cli/dist/index.js --help
```

## Commands

### `civic-mcp create`
Interactive wizard — scaffold a new adapter directory with manifest, adapter.ts, selectors.json, and tests.

### `civic-mcp validate [path]`
Run all pre-publish checks against an adapter:
- manifest.json schema
- Adapter file size (< 500 KB)
- Security scan (no `eval`, `fetch`, `chrome.*`, etc.)
- Test files present
- README present

```bash
civic-mcp validate ./adapters/gov.colorado.peak
civic-mcp validate --no-security-scan  # skip security scan
```

### `civic-mcp link [path]`
Write a dev-link entry to `~/.civic-mcp/dev-links.json` so the extension loads your local adapter without going through the registry.

```bash
civic-mcp link            # links current directory
civic-mcp link --unlink   # removes the link
```

### `civic-mcp launch [url]`
Open Chrome 146+ with the WebMCP experimental flag (`--enable-features=WebMcpApi`) and an isolated dev profile. Also opens `chrome://flags/#web-mcp-api` for verification.

```bash
civic-mcp launch                              # about:blank
civic-mcp launch https://peak.my.site.com
civic-mcp launch --chrome-path /usr/bin/google-chrome-beta
civic-mcp launch --no-sandbox                 # Docker / WSL2
```

### `civic-mcp test [path]`
Run the adapter's Playwright test suite against live sites.

### `civic-mcp publish [path]`
Validate the adapter then print step-by-step instructions for opening a registry PR via `gh`.

```bash
civic-mcp publish --dry-run   # validate only, no PR
```

### `civic-mcp install <adapter-id>`
Print instructions for installing an adapter from the Chrome extension marketplace (native messaging not yet wired).

## Development

```bash
cd packages/cli
pnpm dev        # watch mode
pnpm build      # compile to dist/
pnpm typecheck
```
