# civic-mcp — Build Plan

## Summary of Decisions

| Decision | Choice |
|---|---|
| Scope | All four packages + all four initial adapters |
| Language | TypeScript throughout |
| Extension UI | React + Vite (`@crxjs/vite-plugin`) |
| Adapter testing | Live sites via Playwright |
| Registry | In-repo (`registry/` folder) |
| MCP bridge | `@mcp-b/chrome-devtools-mcp` (no custom bridge) |

---

## Repository Structure (Target)

```
civic-mcp/
├── packages/
│   ├── extension/          # Chrome extension (core runtime)
│   ├── cli/                # civic-mcp CLI tool
│   ├── sdk/                # Shared types + adapter utilities
│   └── testing/            # Test harness for adapter authors
├── adapters/
│   ├── gov.colorado.peak/
│   ├── gov.california.getcalfresh/
│   ├── gov.michigan.bridges/
│   └── gov.texas.yourtexasbenefits/
├── registry/
│   ├── registry.json
│   └── verified.json
├── scripts/
│   ├── update-registry.js
│   └── validate-manifest.js
└── docs/                   # (deferred — not in initial scope)
```

---

## Phase 1 — SDK & Shared Types

**Package**: `packages/sdk`

Everything else depends on shared TypeScript types. Build this first.

### Deliverables

- `packages/sdk/package.json` — package metadata, `@civic-mcp/sdk`
- `packages/sdk/tsconfig.json`
- `packages/sdk/src/types/`
  - `manifest.ts` — `AdapterManifest`, `ToolDefinition`, `Permission`
  - `adapter.ts` — `AdapterModule`, `AdapterContext`, `AdapterTool`
  - `declarative.ts` — `DeclarativeTool`, `NavigationDef`, `InputDef`, `OutputDef`
  - `registry.ts` — `RegistryEntry`, `RegistryIndex`, `VerifiedPublisher`
  - `sandbox.ts` — `SandboxContext`, `PageAPI`, `StorageAPI`, `NotifyAPI`, `UtilsAPI`
- `packages/sdk/src/utils/`
  - `validate-manifest.ts` — validates adapter manifest JSON against the schema
  - `selector-helpers.ts` — shared selector utilities
- `packages/sdk/src/index.ts` — barrel export

### Key Type Contracts

```typescript
// Core adapter module shape
interface AdapterModule {
  id: string;
  version: string;
  init?(context: SandboxContext): Promise<void>;
  tools: AdapterTool[];
}

// Sandbox context passed to JS adapters
interface SandboxContext {
  page: PageAPI;        // navigate, fillField, click, getText, waitForSelector
  storage: StorageAPI;  // get, set, delete (plugin-scoped, 100KB limit)
  notify: NotifyAPI;    // info, warn, error
  utils: UtilsAPI;      // sleep, parseDate, formatCurrency
}

// Declarative tool definition (JSON-only adapters)
interface DeclarativeTool {
  name: string;
  description: string;
  navigation: { url: string; waitForSelector: string };
  inputs: Record<string, InputDef>;
  submit: { selector: string };
  output: Record<string, OutputDef>;
}
```

---

## Phase 2 — Core Extension

**Package**: `packages/extension`

### 2a — Build Setup

- `packages/extension/package.json` — `@civic-mcp/extension`
- `packages/extension/vite.config.ts` — Vite + `@crxjs/vite-plugin`
- `packages/extension/tsconfig.json`
- `packages/extension/manifest.json` — Chrome Manifest V3
  - Permissions: `storage`, `activeTab`, `scripting`
  - Content scripts: inject into all URLs (filtered at runtime by plugin domains)
  - Service worker: `background/service-worker.ts`
  - Popup: `ui/popup/index.html`

### 2b — Core Runtime (`src/core/`)

**`plugin-loader.ts`**
- On `DOMContentLoaded`, fetch enabled plugins from storage
- For each plugin whose `domains` matches the current URL:
  - If `declarative: true` → `loadDeclarativePlugin()`
  - Else → `loadJavaScriptPlugin()`
- `loadDeclarativePlugin()`: iterate tool definitions, build and register WebMCP tools
- `loadJavaScriptPlugin()`: fetch plugin code, verify signature (verified plugins), execute in sandbox, register tools
- `registerTool(name, schema, handler)`: calls `navigator.modelContext.registerTool()`

**`sandbox.ts`** (`PluginSandbox` class)
- `createContext(pluginId, manifest)` → `SandboxContext`
  - `page.*` — all URL navigation checked against plugin's declared `domains`
  - `storage.*` — namespaced to `plugin:${pluginId}:`, enforces 100KB total limit
  - `notify.*` — injects styled notification DOM element
  - `utils.*` — pure helpers (sleep, parseDate, formatCurrency)
- `execute(code, context)` — runs plugin code in isolated `Function()` scope (ironic given the no-eval rule — actually use a locked-down iframe or Worker instead; see Security Notes)
- Blocked: `eval`, `fetch` to non-declared domains, `chrome.*`, `localStorage`, `document.cookie`

> **Security Note**: The `plugin-loader.js` reference implementation uses `new Function()` to execute plugin code. For the real implementation, use a sandboxed `<iframe sandbox="allow-scripts">` or a `Worker` with a controlled message channel. This avoids the `no-new-func` ESLint rule and provides real isolation.

**`registry-client.ts`**
- `fetchRegistry()` — GET `registry/registry.json` (bundled initially; later fetched from GitHub)
- `getInstalledPlugins()` → reads from `chrome.storage.local`
- `isPluginEnabled(id)` → checks enabled list
- `installPlugin(id)` → download, verify, store plugin code + manifest
- `uninstallPlugin(id)` → remove from storage
- `checkForUpdates()` → compare installed versions against registry

**`updater.ts`**
- On extension startup, check for plugin updates (if auto-update enabled)
- Notify user of available updates via badge/notification

### 2c — Background Service Worker (`src/background/`)

**`service-worker.ts`**
- Handles messages from popup/marketplace: install, uninstall, enable, disable, update
- Runs `updater.checkForUpdates()` on startup and on schedule (every 24h)
- Manages `chrome.storage.local` for plugin metadata

### 2d — Extension UI (`src/ui/`)

All UI built with React + Vite.

**Popup** (`src/ui/popup/`)
- `App.tsx` — root, shows installed plugins list
- `PluginCard.tsx` — per-plugin row with enable/disable/remove/settings buttons
- `EmptyState.tsx` — "No plugins installed. Browse the marketplace."
- Links to `marketplace.html` and `settings.html`
- Shows which tools are available on the current page (active tab domain match)

**Marketplace** (`src/ui/marketplace/`)
- `App.tsx` — root with search + filter
- `PluginGrid.tsx` — grid of `PluginListCard` components
- `PluginListCard.tsx` — card showing name, trust badge, programs, install count
- `PluginDetail.tsx` — expanded view: tools list, permissions, version history
- `InstallModal.tsx` — permission prompt before installation
- `SearchBar.tsx` + `FilterPanel.tsx` — filter by state, program, trust level
- Data: loaded from `registry/registry.json` (bundled) + optional live fetch

**Settings** (`src/ui/settings/`)
- Per-plugin settings (tool toggles, auto-update, anonymous stats)
- Global settings (auto-update, telemetry opt-in)

**Shared components** (`src/ui/components/`)
- `TrustBadge.tsx` — Official/Verified/Community badge
- `PermissionList.tsx` — human-readable permission list
- `StatusIndicator.tsx` — green/yellow/red plugin status dot

---

## Phase 3 — CLI

**Package**: `packages/cli`

### Deliverables

- `packages/cli/package.json` — `@civic-mcp/cli`, `bin: { civic-mcp }`
- `packages/cli/src/commands/`
  - `create.ts` — scaffold new adapter directory
  - `install.ts` — install adapter from registry into extension storage
  - `validate.ts` — run manifest + security checks
  - `publish.ts` — submit adapter to registry (opens GitHub PR via `gh` CLI)
  - `test.ts` — run adapter tests with Playwright
  - `link.ts` — link local adapter to dev extension for live testing
- `packages/cli/src/scaffolding/`
  - `templates/` — mustache/handlebars templates for manifest.json, adapter.ts, README.md
- `packages/cli/src/validators/`
  - `manifest-validator.ts` — JSON schema validation
  - `security-scanner.ts` — AST scan for disallowed patterns (eval, fetch, etc.)

### CLI Commands

```bash
civic-mcp create adapter          # Interactive scaffold wizard
civic-mcp validate [path]         # Validate manifest + security scan
civic-mcp test [path]             # Run Playwright tests against live site
civic-mcp link [path]             # Hot-link adapter to dev extension
civic-mcp install <adapter-id>    # Install from registry
civic-mcp publish [path]          # Submit to registry (opens PR)
```

---

## Phase 4 — Testing Framework

**Package**: `packages/testing`

### Deliverables

- `packages/testing/package.json` — `@civic-mcp/testing`
- `packages/testing/src/`
  - `harness.ts` — `AdapterTestHarness` class
    - Launches Playwright Chromium with the civic-mcp extension loaded
    - Provides `testTool(name, params)` that calls the registered WebMCP tool
    - Provides `mockNavigate()` / `assertFieldFilled()` helpers
  - `assertions.ts` — custom vitest matchers (`toHaveRegisteredTool`, `toReturnSuccess`)
  - `fixtures.ts` — shared test fixtures and fake user data
- `packages/testing/src/validators/`
  - `schema-validator.ts` — validates tool input/output against JSON schema
  - `manifest-validator.ts` — re-exports from SDK
- Test utilities for both declarative and JS adapters

### Test Pattern (for adapter authors)

```typescript
import { createHarness } from '@civic-mcp/testing';

const harness = createHarness({
  adapter: './adapter.ts',
  manifest: './manifest.json',
});

test('check_eligibility returns result', async () => {
  const result = await harness.testTool('check_eligibility', {
    householdSize: 3,
    monthlyIncome: 2500,
  });
  expect(result.success).toBe(true);
  expect(result).toHaveProperty('eligible');
});
```

> **Note**: Tests run against live sites. Government sites may require authentication, have CAPTCHA, or rate-limit. Each adapter's test suite must handle this (e.g., require pre-authenticated session, use screener tools that don't need login, or explicitly mark tests as `skip` when site is unavailable).

---

## Phase 5 — Adapters

All four adapters built in parallel after the extension core and SDK are stable.

### Common Adapter Structure

```
adapters/gov.{state}.{portal}/
├── manifest.json          # Required: id, name, version, domains, tools, permissions
├── adapter.ts             # Main adapter (JS plugin) or declarative.json
├── selectors.json         # DOM selector map (separate from adapter logic)
├── icon.png               # 48x48 adapter icon
├── README.md              # Tool docs, prerequisites, testing date
└── tests/
    ├── check-eligibility.test.ts
    └── fixtures/          # Any shared test data
```

### Adapter 1: `gov.colorado.peak`

- **Site**: `peak.my.site.com`, `colorado.gov/peak`
- **Programs**: SNAP, Medicaid, Colorado Works, CHP+
- **Trust level**: Verified
- **Tools**:
  - `check_application_status` — look up existing application by ID/SSN
  - `start_snap_application` — begin new SNAP application (returns application ID)
  - `check_program_eligibility` — income/household pre-screener
  - `get_peak_page_info` — return current page context/state
- **Approach**: JavaScript adapter (Salesforce-based site needs dynamic interaction)
- **Auth requirements**: `check_application_status` requires login; screener tools do not

### Adapter 2: `gov.california.getcalfresh`

- **Site**: `www.getcalfresh.org`
- **Programs**: CalFresh (SNAP)
- **Trust level**: Verified
- **Tools**:
  - `check_eligibility` — household/income pre-screener
  - `start_application` — begin CalFresh application
- **Approach**: Hybrid (declarative for screener, JS for multi-step application)
- **Reference**: Full example already in `example-plugins.js` — adapt to TypeScript

### Adapter 3: `gov.michigan.bridges`

- **Site**: `newmibridges.michigan.gov`
- **Programs**: SNAP, Medicaid, Cash Assistance
- **Trust level**: In Review (target: Verified)
- **Tools**:
  - `check_eligibility` — program pre-screener
  - `start_application` — begin application
  - `check_application_status` — lookup existing application
- **Approach**: TBD after site research

### Adapter 4: `gov.texas.yourtexasbenefits`

- **Site**: `yourtexasbenefits.com`
- **Programs**: SNAP, TANF, Medicaid, CHIP
- **Trust level**: In Review (target: Verified)
- **Tools**:
  - `check_eligibility` — screener
  - `start_application` — begin application
  - `get_benefit_status` — check existing benefits
- **Approach**: TBD after site research
- **Reference**: Full walkthrough in `CONTRIBUTING.md`

---

## Phase 6 — Registry & Scripts

### `registry/registry.json`

Initial seed with all four adapters. Structure per DESIGN.md.

### `registry/verified.json`

Verified publisher list (Nava PBC, Code for America, USDS, etc.).

### `scripts/update-registry.js`

- Scans `adapters/` directory
- Reads each `manifest.json`
- Updates `registry/registry.json` with current metadata
- Run as: `npm run registry:update`

### `scripts/validate-manifest.js`

- Used by lint-staged (already in `package.json`)
- Validates any changed `adapters/*/manifest.json` against the schema on commit

---

## Implementation Order

```
1. packages/sdk              → types + schema validation (everything depends on this)
2. registry/                 → seed registry.json + verified.json
3. scripts/                  → validate-manifest.js + update-registry.js
4. packages/extension        → core runtime (plugin-loader, sandbox, registry-client)
5. packages/extension        → UI (popup, marketplace, settings) with React + Vite
6. packages/cli              → CLI commands (create, validate, install, link, publish, test)
7. packages/testing          → Playwright harness + vitest matchers
8. adapters/ (all four)      → site research → selector mapping → adapter code → tests
```

Adapters should be developed after the extension core is runnable so they can be manually tested in Chrome during development.

---

## Open Questions / Risks

### 1. WebMCP API Availability
`navigator.modelContext.registerTool()` is only available in Chrome 146+ with the WebMCP experimental flag enabled. The chrome-devtools-mcp bridge approach does not require this flag — it uses the DevTools Protocol instead. Clarify which registration path is primary for the MVP.

### 2. Live Site Testing in CI
Government sites may have:
- CAPTCHA on form submissions
- Login walls (most status-check tools)
- Rate limiting
- Frequent DOM changes

**Mitigation**: Mark integration tests as `@live` and gate them on a manual trigger. Use `vi.skip` for tests that require authenticated sessions. Pre-screener/eligibility tools (no login) are the safest starting point.

### 3. Salesforce Sites (Colorado PEAK)
Salesforce Experience Cloud sites (peak.my.site.com) render content dynamically via LWC (Lightning Web Components). Standard CSS selectors are fragile. The adapter will need extra `waitForSelector` calls and should target Salesforce-specific data attributes where possible.

### 4. Sandbox Implementation
The reference `plugin-loader.js` uses `new Function()` which triggers the `no-new-func` ESLint rule already configured in `package.json`. Real sandboxing should use an `<iframe sandbox="allow-scripts allow-same-origin">` with `postMessage` communication, or a `Worker`. This adds complexity to the plugin execution pipeline but is essential for real security.

### 5. Extension Manifest V3 Constraints
MV3 service workers cannot hold long-lived connections. The plugin loader runs as a content script (not the service worker), which is fine. The service worker only handles install/update operations and badge management. Confirm this aligns with the chrome-devtools-mcp bridge's requirements.

---

## Definition of Done (MVP)

- [ ] `npm install` succeeds across all workspaces
- [ ] `npm run build:extension` produces a loadable Chrome extension in `packages/extension/dist/`
- [ ] Extension popup shows installed plugins and links to marketplace
- [ ] Marketplace shows all four adapters from `registry/registry.json`
- [ ] One adapter (gov.california.getcalfresh) installs via popup and registers at least one tool on the target site
- [ ] `civic-mcp create adapter` scaffolds a new adapter directory
- [ ] `civic-mcp validate` passes on all four adapters
- [ ] `npm run test` passes unit tests across all packages
- [ ] `npm run lint` produces zero errors
