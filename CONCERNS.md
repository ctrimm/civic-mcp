# Deferred Concerns

Issues flagged during planning that are intentionally out of scope for the initial build. Revisit before production launch.

---

## 1. MCP Bridge (chrome-devtools-mcp)

**Decision**: MVP targets Chrome 146+ with the WebMCP experimental flag enabled. Tools are registered exclusively via `navigator.modelContext.registerTool()`.

**Deferred**: Bridging to MCP clients (Claude Desktop, Cursor, etc.) via `@mcp-b/chrome-devtools-mcp` for users without the WebMCP flag.

**When to revisit**: Before Chrome Web Store launch. Adds a DevTools Protocol relay layer that makes the extension usable without the flag.

---

## 2. Sandbox Hardening

**Decision**: MVP uses `new Function()` / isolated function scope for JS plugin execution (matching the reference `plugin-loader.js`). The `no-new-func` ESLint rule will be disabled for the sandbox file with a targeted override.

**Deferred**: Replacing with a true `<iframe sandbox="allow-scripts">` + `postMessage` boundary for real process isolation.

**When to revisit**: Before the Community plugin trust level opens to arbitrary contributors. Required for any plugin that does not have Verified status.

---

## 3. Salesforce / LWC Sites (Colorado PEAK)

**Decision**: Build the Colorado PEAK adapter and mark it as best-effort. The adapter will use standard CSS selectors with generous `waitForSelector` timeouts and Shadow DOM piercing where needed.

**Deferred**: A robust LWC-aware selector strategy and an automated monitor that detects when Salesforce page structure changes break the adapter.

**When to revisit**: After initial adapter tests run against the live site. May require the adapter to be downgraded from Verified to Community if selector stability is poor.

---

## 4. Authenticated Tool Testing

**Decision**: `@live` integration tests are accepted. Tests that require a logged-in session are marked `@authenticated` and run manually / in a dedicated CI environment with pre-seeded credentials.

**Deferred**: A shared secrets vault (e.g. GitHub Actions secrets + environment), a session fixture record/replay system, and a policy for storing test account credentials securely.

**When to revisit**: When setting up automated nightly regression runs against live sites.
