# Deferred Concerns

Issues flagged during planning that are intentionally out of scope for the initial build. Revisit before production launch.

---

## 1. MCP Bridge — RESOLVED (superseded)

**Original decision**: MVP targets Chrome 146+ with the WebMCP experimental flag; bridge to MCP clients via `@mcp-b/chrome-devtools-mcp` later.

**Resolution (2026-06)**: A standalone MCP server (`packages/mcp-server`) is now the primary path — it speaks stdio JSON-RPC to any MCP client and drives Playwright directly, requiring no Chrome flag and no extension. The extension is demoted to experimental (see `packages/extension/README.md` for its structural gaps). The server also injects an experimental WebMCP polyfill stub to observe real-world `navigator.modelContext` adoption; a full polyfill→MCP bridge is the upgrade path once sites ship WebMCP tools.

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

---

## 5. Identity store on keychainless systems

**Decision**: Applicant profiles are encrypted with a per-identity key held in the OS keychain (`@napi-rs/keyring`). Systems without a usable keychain (headless Linux without a Secret Service) cannot save a profile unless `CIVIC_MCP_INSECURE_STORE=1` (plaintext, 0600 perms, loud warning).

**Deferred**: A passphrase-based fallback (scrypt/argon2-derived key) so keychainless systems still get encryption at rest; key rotation; encrypting adapter storage (not just the profile).

**When to revisit**: Before recommending civic-mcp to caseworkers on managed/shared machines.

---

## 6. Single-user concurrency

**Decision**: One persistent browser context, one long-lived page per adapter. Concurrent tool calls to the same adapter share a page and can interleave.

**Deferred**: Per-call queuing or page leasing to serialize calls per adapter.

**When to revisit**: If/when MCP clients start issuing parallel tool calls in practice.
