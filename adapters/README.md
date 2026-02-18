# adapters/

Site adapters are the plugins that register WebMCP tools for individual government websites. Each adapter lives in its own directory named after its reverse-DNS ID.

## Structure

```
adapters/
└── gov.colorado.peak/
    ├── manifest.json       # Adapter metadata and tool declarations
    ├── adapter.ts          # Tool implementations (TypeScript)
    ├── selectors.json      # DOM selectors (separated from logic)
    ├── tests/
    │   └── check-eligibility.test.ts
    └── README.md
```

## Current adapters

| ID | Site | Trust | Programs |
|----|------|-------|----------|
| `gov.colorado.peak` | peak.my.site.com | ✅ Verified | SNAP, Medicaid, Colorado Works, CHP+ |
| `gov.california.getcalfresh` | getcalfresh.org | ✅ Verified | CalFresh / SNAP |
| `gov.michigan.bridges` | newmibridges.michigan.gov | 🌐 Community | SNAP, Medicaid, Cash Assistance |
| `gov.texas.yourtexasbenefits` | yourtexasbenefits.com | 🌐 Community | SNAP, TANF, Medicaid, CHIP |

## Create a new adapter

```bash
# Scaffold from the CLI wizard
civic-mcp create

# Link to the dev extension for live testing
cd adapters/gov.yourstate.portal
civic-mcp link

# Validate before publishing
civic-mcp validate

# Submit to the registry
civic-mcp publish
```

## Adapter manifest fields

```jsonc
{
  "id": "gov.state.portal",       // reverse-DNS, unique
  "name": "State Portal",
  "version": "0.1.0",             // semver
  "trustLevel": "community",      // official | verified | community
  "domains": ["portal.state.gov"],
  "tools": [{ "name": "check_eligibility", "description": "…" }],
  "permissions": {
    "required": ["read:forms", "write:forms", "navigate"],
    "optional": ["storage:local", "notifications"]
  }
}
```

## Testing adapters

Tests use [Playwright](https://playwright.dev) to drive a real browser against the live site. See [`packages/testing`](../packages/testing/README.md) for the full API.

```bash
# One-time: install the Playwright browser
pnpm exec playwright install chromium

# Run all adapter tests
pnpm test:adapters

# Run one adapter
pnpm exec vitest run adapters/gov.colorado.peak

# Show the browser window while running
CIVIC_MCP_HEADED=1 pnpm exec vitest run adapters/gov.colorado.peak
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full submission process.
