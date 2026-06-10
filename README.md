# civic-mcp

> WebMCP abstraction layer for government websites — install adapters for any state or federal service and let AI agents navigate forms, check eligibility, and submit applications on behalf of citizens.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Chrome 146+](https://img.shields.io/badge/Chrome-146%2B-yellow.svg)](https://developer.chrome.com/blog/webmcp-epp)
[![WebMCP](https://img.shields.io/badge/WebMCP-W3C%20Draft-green.svg)](https://webmachinelearning.github.io/webmcp/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## The Problem

Government websites were built for humans clicking through forms. AI agents that try to help citizens navigate them must resort to screenshot parsing, brittle DOM scraping, and fragile click sequences — burning tokens, breaking on every UI update, and failing the people who need help most.

Meanwhile, the vendors who built these portals have no incentive to expose APIs. Procurement lock-in means the integration layer never gets built.

## The Solution

`civic-mcp` injects a thin [WebMCP](https://webmachinelearning.github.io/webmcp/) abstraction layer into government websites via a Chrome extension. Instead of an agent guessing which button to click, the site exposes structured, callable tools — and the agent uses them directly.

No backend changes. No vendor cooperation. No multi-year API development projects.

```
Before: agent → screenshot → vision model → click → hope it worked
After:  agent → civic-mcp → registerTool() → execute() → structured JSON
```

Adapters are community-contributed and independently maintained — one per government site. You install only what you need.

---

## Quick Start

### Prerequisites

- Chrome 146+ (or Chrome Canary)
- Enable **WebMCP for testing** in `chrome://flags`

### Install the Extension

```bash
# Option 1: Chrome Web Store (coming soon)

# Option 2: Build from source
git clone https://github.com/ctrimm/civic-mcp.git
cd civic-mcp
npm install
npm run build:extension
```

Then load `packages/extension/dist` as an unpacked extension via `chrome://extensions`.

### Install Adapters

Open the extension popup and click **Browse Adapters**, or install via CLI:

```bash
npm install -g @civic-mcp/cli

civic-mcp install gov.colorado.peak
civic-mcp install gov.california.getcalfresh
civic-mcp install gov.federal.ssa
```

### Connect to an AI Agent

There are two ways to wire civic-mcp into a MCP-compatible client (Claude Desktop, Cursor, etc.):

**Option A — Standalone MCP server** (recommended, no extension needed)

Add to `~/.claude/claude_desktop_config.json` (or your client's MCP config):

```json
{
  "mcpServers": {
    "civic-mcp": {
      "command": "npx",
      "args": ["tsx", "/path/to/civic-mcp/packages/mcp-server/src/index.ts"],
      "env": { "CIVIC_MCP_HEADED": "1" }
    }
  }
}
```

The server scans the `adapters/` directory on startup, registers every tool, and drives a Playwright browser in the background. Set `CIVIC_MCP_HEADED=1` for tools that require a visible browser (e.g. solving a CAPTCHA with `waitForHuman()`).

**Option B — Chrome extension + DevTools bridge** (browser-context tools)

```json
{
  "mcpServers": {
    "civic-mcp": {
      "command": "npx",
      "args": ["@mcp-b/chrome-devtools-mcp@latest"]
    }
  }
}
```

Install the extension, open the target site in Chrome, then ask Claude:

> *"Check if a household of 3 with $2,400/month income is eligible for SNAP and Medicaid in Colorado."*

---

## Available Adapters

### State Benefits

| Adapter | State | Programs | Status |
|---------|-------|----------|--------|
| [`gov.colorado.peak`](adapters/gov.colorado.peak) | Colorado | SNAP, Medicaid, Colorado Works, CHP+ | 🧪 Community (selectors unverified) |
| [`gov.california.getcalfresh`](adapters/gov.california.getcalfresh) | California | CalFresh (SNAP) | 🧪 Community (selectors unverified) |
| [`gov.michigan.bridges`](adapters/gov.michigan.bridges) | Michigan | SNAP, Medicaid, Cash | 🧪 Community (selectors unverified) |
| [`gov.texas.yourtexasbenefits`](adapters/gov.texas.yourtexasbenefits) | Texas | SNAP, TANF, Medicaid, CHIP | 🧪 Community (selectors unverified) |

### Federal Services

| Adapter | Agency | Services | Status |
|---------|--------|----------|--------|
| [`gov.ssa.retirement`](adapters/gov.ssa.retirement) | Social Security Administration | Retirement benefit estimates, application start | 🧪 Community (selectors unverified) |
| [`gov.federal.va`](adapters/gov.federal.va) | Dept. of Veterans Affairs | Benefits, Healthcare | 🚧 Planned |
| [`gov.federal.benefits`](adapters/gov.federal.benefits) | Benefits.gov | Multi-program screener | 🚧 Planned |

**[Browse all adapters →](https://civic-mcp.dev/adapters)**
**[Request an adapter →](https://github.com/ctrimm/civic-mcp/issues/new?template=adapter-request.md)**

---

## Repository Structure

```
civic-mcp/
├── packages/
│   ├── extension/          # Chrome extension (core runtime)
│   │   ├── src/
│   │   │   ├── core/       # Plugin loader, sandbox, registry client
│   │   │   ├── ui/         # Popup, marketplace, settings
│   │   │   └── background/ # Service worker
│   │   └── manifest.json
│   ├── mcp-server/         # Standalone MCP server — exposes all adapters to
│   │                       #   Claude Desktop, Cursor, and any MCP client
│   │                       #   over stdio JSON-RPC (no extension required)
│   ├── cli/                # civic-mcp CLI for adapter development
│   ├── sdk/                # Adapter development SDK + types
│   └── testing/            # Test harness for adapter authors
├── adapters/               # Community-contributed site adapters
│   ├── gov.colorado.peak/
│   ├── gov.california.getcalfresh/
│   ├── gov.ssa.retirement/
│   └── .../
├── registry/               # Adapter registry metadata
│   ├── registry.json       # Master adapter list
│   └── verified.json       # Verified publisher list
├── docs/                   # Documentation site source
└── scripts/                # Build and maintenance scripts
```

---

## Writing an Adapter

Adapters are the heart of civic-mcp. Anyone can write one. The simplest adapter is **pure JSON** — no JavaScript required.

### Declarative Adapter (Recommended)

```json
{
  "id": "gov.example.benefits",
  "name": "Example State Benefits",
  "version": "1.0.0",
  "domains": ["benefits.example.gov"],
  "declarative": true,
  "tools": [
    {
      "name": "check_eligibility",
      "description": "Pre-screen eligibility for state benefits",
      "navigation": {
        "url": "https://benefits.example.gov/screener",
        "waitForSelector": "form#screener"
      },
      "inputs": {
        "householdSize": {
          "selector": "input[name='household_size']",
          "type": "number",
          "required": true
        },
        "monthlyIncome": {
          "selector": "input[name='monthly_income']",
          "type": "number",
          "required": true
        }
      },
      "submit": { "selector": "button[type='submit']" },
      "output": {
        "eligible": { "selector": ".result .eligible", "type": "boolean" },
        "message": { "selector": ".result .message", "type": "text" }
      }
    }
  ],
  "permissions": {
    "required": ["read:forms", "write:forms"]
  }
}
```

### JavaScript Adapter (Complex Workflows)

```javascript
// adapters/gov.example.benefits/adapter.js
export default {
  id: 'gov.example.benefits',

  async init(context) {
    // Called once when adapter loads on the target page
  },

  tools: [
    {
      name: 'start_application',
      description: 'Begin a new benefits application',
      inputSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          dateOfBirth: { type: 'string', format: 'date' },
        },
        required: ['firstName', 'lastName', 'dateOfBirth'],
      },

      async execute(params, context) {
        const { page, storage, notify } = context;

        await page.navigate('https://benefits.example.gov/apply');
        await page.fillField('input[name="first_name"]', params.firstName);
        await page.fillField('input[name="last_name"]', params.lastName);
        await page.fillField('input[name="dob"]', params.dateOfBirth);
        await page.click('button#continue');

        const appId = await page.getText('.confirmation-number');
        return { success: true, applicationId: appId };
      },
    },
  ],
};
```

### Scaffold a New Adapter

```bash
civic-mcp create adapter

? Adapter ID: gov.newstate.portal
? Name: New State Benefits Portal
? Website: https://portal.newstate.gov
? Programs: SNAP, Medicaid

✓ Created adapters/gov.newstate.portal/
```

**[Full adapter development guide →](docs/adapters/creating-adapters.md)**

---

## Security Model

### Adapter Trust Levels

| Level | Who | Review | Capabilities |
|-------|-----|--------|--------------|
| 🔵 **Official** | Government agencies | Audit + digital signature | All operations |
| 🟢 **Verified** | Known civic tech orgs | Code review by maintainers | Standard operations |
| 🟡 **Community** | Anyone | Automated scan + peer review | Standard operations |

### Sandbox Guarantees

All adapters run in a security sandbox regardless of trust level. Adapters **cannot**:

- Call `eval()`, `Function()`, or `new Function()`
- Make `fetch()` requests outside declared domains
- Access `navigator.modelContext` directly
- Read or write cookies
- Access other adapters' storage
- Load external scripts

Adapters can only interact through the controlled `context` API — equivalent to what a logged-in human could do manually.

### Reporting Security Issues

Report vulnerabilities privately via [SECURITY.md](SECURITY.md). Do **not** open public issues for security bugs.

---

## Contributing

We welcome all kinds of contributions.

**Contribute an adapter** — the highest-impact contribution. See the [adapter development guide](docs/adapters/creating-adapters.md).

```bash
civic-mcp create adapter   # scaffold
civic-mcp test             # test locally
civic-mcp publish          # submit to registry
```

**Improve the core extension** — see [packages/extension/CONTRIBUTING.md](packages/extension/CONTRIBUTING.md).

**Improve documentation** — see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

**Report a bug or request an adapter** — use [GitHub Issues](https://github.com/ctrimm/civic-mcp/issues).

**[Full contribution guide →](CONTRIBUTING.md)**

---

## Governance

civic-mcp is maintained by a coalition of civic technology organizations. Core decisions are made via [RFC process](docs/rfcs/). Adapter reviews are handled by domain-specific working groups.

See [MAINTAINERS.md](MAINTAINERS.md) and [GOVERNANCE.md](GOVERNANCE.md).

---

## Why AGPL-3.0?

Government services are public goods. The software that makes them more accessible should remain a public good too.

AGPL ensures that anyone who deploys civic-mcp as a networked service — including government vendors and SaaS providers — must contribute their improvements back to the commons. MIT or Apache would allow a vendor to fork this, add proprietary adapters, and sell access to them, recreating exactly the lock-in we're trying to break.

AGPL closes that door. Individual users and government agencies using the extension are unaffected — the license only activates when you run a modified version as a service for others.

---

## Roadmap

| Milestone | Target | Status |
|-----------|--------|--------|
| Core extension + plugin loader | Q1 2026 | 🔄 In Progress |
| CLI tooling + adapter SDK | Q1 2026 | 🔄 In Progress |
| Standalone MCP server bridge | Q1 2026 | 🔄 In Progress |
| 5 verified adapters | Q2 2026 | 🚧 Planned |
| Chrome Web Store launch | Q2 2026 | 🚧 Planned |
| 25 state adapters | Q3 2026 | 🚧 Planned |
| Federal agency adapters | Q3 2026 | 🔄 In Progress |
| Adapter certification program | Q4 2026 | 🚧 Planned |

---

## Related Projects

- [WebMCP Specification](https://webmachinelearning.github.io/webmcp/) — W3C draft standard this is built on
- [Model Context Protocol](https://modelcontextprotocol.io/) — Anthropic's agent tool protocol
- [mcp-b / chrome-devtools-mcp](https://github.com/WebMCP-org/chrome-devtools-quickstart) — Chrome DevTools bridge for WebMCP
- [Code for America](https://codeforamerica.org) — Civic tech ecosystem
- [Nava PBC](https://navapbc.com) — Government digital services

---

## License

Copyright © 2026 civic-mcp contributors

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [LICENSE](LICENSE) for more details.

---

*civic-mcp is an independent open source project. It is not affiliated with, endorsed by, or operated by any government agency.*
