# Portable Identities

A civic-mcp **identity** is a named, on-disk bundle of everything needed to act
on someone's behalf across government websites. It is a documented contract —
other programs are encouraged to mount the same layout.

## Layout

```
~/.civic-mcp/identities/<name>/
├── README.txt          # warning about sensitive contents
├── browser-profile/    # Chromium user-data dir (cookies, logins, localStorage)
├── profile.json.enc    # applicant profile, AES-256-GCM encrypted
└── storage/            # adapter-scoped key/value storage
    └── <adapterId>.json
```

All directories are created `0700`, all files `0600`.

## Selecting an identity

The MCP server uses the `CIVIC_MCP_IDENTITY` environment variable
(default: `default`):

```json
{
  "mcpServers": {
    "civic-mcp-mom": {
      "command": "npx",
      "args": ["tsx", "/path/to/civic-mcp/packages/mcp-server/src/index.ts"],
      "env": { "CIVIC_MCP_IDENTITY": "mom", "CIVIC_MCP_HEADED": "1" }
    }
  }
}
```

Multiple identities support the most important real-world scenario: a family
member, caseworker, or benefits navigator assisting more than one person.
Each person's logins, applicant data, and adapter state stay fully separated.

## What persists, and when

- **Logins (cookies)** live in `browser-profile/` and survive across tool
  calls *and* server restarts. Log in once in headed mode
  (`CIVIC_MCP_HEADED=1`); subsequent calls reuse the session.
- **Page state** (a half-completed multi-step form) survives across tool calls
  within one server run — each adapter keeps its page open between calls.
- The `session_reset` tool closes all pages; pass `clearCookies: true` to also
  log out everywhere.

## The applicant profile

`profile.json.enc` holds an `ApplicantProfile` (see
`packages/sdk/src/types/identity.ts`): name, date of birth, contact info,
address, household composition, and income figures. Adapters get **read-only**
access via `context.identity.getProfile()` to prefill forms; only the host
(the `identity_set_profile` MCP tool) can write it.

Two hard rules:

1. **Full SSNs are never stored.** Only `ssnLast4` is accepted; the store
   refuses anything that looks like a full SSN. Tools that need a full SSN
   must pause with `waitForHuman()` so the person types it directly into the
   government site.
2. **Adapters cannot write the profile.** A misbehaving adapter cannot poison
   data that other adapters will trust.

## Encryption

On first use, a random 256-bit key is generated per identity and stored in the
OS keychain (macOS Keychain, Windows Credential Manager, libsecret/Secret
Service on Linux) under service `civic-mcp`, account `identity:<name>`.
`profile.json.enc` is AES-256-GCM encrypted with that key.

On systems without a usable keychain (typically headless Linux without a
running Secret Service), saving a profile **fails loudly** rather than
silently degrading. To accept plaintext-at-rest protected only by file
permissions, set `CIVIC_MCP_INSECURE_STORE=1`.

The browser profile itself is not additionally encrypted — Chromium must read
it live. Treat the whole identity directory as sensitive: never commit, sync,
or share it.

## Portability

The `browser-profile/` directory is a standard Chromium user-data dir. Other
tools can reuse the same logged-in sessions:

```bash
# Plain Chrome / Chromium
chromium --user-data-dir=$HOME/.civic-mcp/identities/default/browser-profile

# Playwright
const ctx = await chromium.launchPersistentContext(
  `${os.homedir()}/.civic-mcp/identities/default/browser-profile`);
```

Only one process can use a Chromium profile at a time — stop the MCP server
(or call `session_reset`) before attaching another tool.
