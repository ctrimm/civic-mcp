# @civic-mcp/extension

> ⚠️ **EXPERIMENTAL — not functional end-to-end.** The supported way to use
> civic-mcp today is the [MCP server](../mcp-server). This extension is the
> long-term bet for when [WebMCP](https://webmachinelearning.github.io/webmcp/)
> ships broadly in browsers. Known structural gaps before it can work:
>
> 1. **Adapter delivery** — the install flow fetches only `manifest.json`,
>    never adapter code; and adapters are TypeScript, which the sandbox's
>    `new Function()` cannot execute. Needs a compile-and-bundle step
>    (adapters shipped inside extension releases, not fetched at runtime —
>    also required by Chrome Web Store remote-code policy).
> 2. **Cross-navigation orchestration** — `page.navigate()` destroys the
>    content-script context, so any multi-page tool flow dies mid-call.
>    Orchestration must move to the service worker.
> 3. **Unverified assumption** — that `navigator.modelContext` is reachable
>    from a content script's isolated world at all. Verify in Chrome Canary
>    before building further.

Chrome Manifest V3 extension — the core runtime that loads adapters, sandboxes their code, registers tools via `navigator.modelContext` (WebMCP), and provides the marketplace / popup / settings UI.

## Prerequisites

- **Chrome 146+** with the WebMCP flag enabled
- Node 18+

```bash
# Quickest way to open Chrome with the right flag:
civic-mcp launch
```

Or toggle manually: `chrome://flags/#web-mcp-api` → **Enabled**

## Build

```bash
# From the repo root:
pnpm build:extension

# Or from this package:
cd packages/extension
pnpm build      # → dist/
pnpm dev        # watch mode (rebuilds on save)
```

## Load in Chrome

1. Navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `packages/extension/dist/`

The extension icon appears in the toolbar. Click it to open the popup.

## Architecture

```
src/
├── background/
│   └── service-worker.ts   # Handles install/uninstall/update messages
├── content/
│   └── index.ts            # Injected into every page; calls initPluginLoader()
├── core/
│   ├── plugin-loader.ts    # Matches adapters to current URL; registers tools
│   ├── sandbox.ts          # SandboxContext — safe page/storage/notify APIs
│   ├── registry-client.ts  # CRUD for installed plugins in chrome.storage.local
│   └── updater.ts          # 24-hour update check; sets badge count
└── ui/
    ├── popup/              # Installed plugins list (React)
    ├── marketplace/        # Browse + install adapters (React)
    └── settings/           # Per-plugin tool toggles (React)
```

## Key concepts

- **Sandbox:** Adapters never get raw DOM or `chrome.*` access. They receive a `SandboxContext` with controlled `page`, `storage`, and `notify` APIs.
- **WebMCP registration:** Each tool is registered as `navigator.modelContext.registerTool({ name, description, inputSchema, execute })`. Tool names are namespaced: `gov.colorado.peak.check_eligibility`.
- **Registry:** Reads from `registry/registry.json` (baked in at build time via Vite import).

## Scripts

```bash
pnpm build      # production build
pnpm dev        # watch + rebuild
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest
```
