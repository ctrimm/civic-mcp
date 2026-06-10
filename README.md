# civic-mcp

> An MCP server (plus community adapters) that lets AI agents help people navigate government websites — check eligibility, track cases, and start benefit applications. Works today with Claude Desktop, Cursor, and any MCP client. No browser flags, no extension required.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![MCP](https://img.shields.io/badge/MCP-stdio-green.svg)](https://modelcontextprotocol.io/)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange.svg)](#project-status)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Project Status

**Pre-alpha.** The MCP server, SDK, CLI, and test harness build and run. One
adapter tool is verified against its live government site: `gov.ssa.retirement`'s
benefit estimator passed its full live test suite in CI on 2026-06-10
([evidence](https://github.com/ctrimm/civic-mcp/actions/runs/27248526562)).
All other adapters have **unverified selectors** — treat them as starting points,
not finished integrations. Verification runs via the
[verify-live workflow](.github/workflows/verify-live.yml). An experimental Chrome
extension also lives in this repo — see
[Experimental: Chrome extension](#experimental-chrome-extension--webmcp).

## The Problem

Government websites were built for humans clicking through forms. AI agents that try to help citizens navigate them must resort to screenshot parsing, brittle DOM scraping, and fragile click sequences — burning tokens, breaking on every UI update, and failing the people who need help most.

Meanwhile, the vendors who built these portals have no incentive to expose APIs. Procurement lock-in means the integration layer never gets built.

## The Solution

`civic-mcp` ships a **standalone MCP server** that loads community-written site
adapters and drives a real browser (Playwright) on the user's machine. Each adapter
turns one government website into a set of structured, callable tools:

```
Before: agent → screenshot → vision model → click → hope it worked
After:  agent → MCP tool call → adapter drives the site → structured JSON
```

No backend changes. No vendor cooperation. No multi-year API development projects.
Adapters are community-contributed and independently maintained — one per
government site.

---

## Quick Start

### Prerequisites

- Node.js 18+ and [pnpm](https://pnpm.io)
- A Chromium build for Playwright (`npx playwright install chromium`)

### Install

```bash
git clone https://github.com/ctrimm/civic-mcp.git
cd civic-mcp
pnpm install
```

### Connect to an AI client

Add to `~/.claude/claude_desktop_config.json` (or Cursor's `~/.cursor/mcp.json`):

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

The server scans `adapters/` on startup and registers every tool. Then ask your agent:

> *"Estimate my Social Security retirement benefit — I was born in 1965 and earn $74,000."*

### Configuration

| Env var | Default | Effect |
|---|---|---|
| `CIVIC_MCP_HEADED` | off | Visible browser window — needed for logins, CAPTCHAs, and `waitForHuman()` steps |
| `CIVIC_MCP_ALLOW_WRITE` | off | Enables **write tools** (those that fill/submit real applications). Off by default for safety |
| `CIVIC_MCP_IDENTITY` | `default` | Which [portable identity](docs/identity.md) to use |
| `CIVIC_MCP_ADAPTERS_DIR` | `adapters/` | Where to load adapters from |
| `CIVIC_MCP_TIMEOUT` | `60000` | Per-action timeout (ms) |

### Identities: logins and applicant data that persist

The server keeps everything tied to a named **identity** at
`~/.civic-mcp/identities/<name>/`:

- **Logins persist** — sign in to a portal once (headed mode); the session is
  remembered across tool calls *and* server restarts.
- **Multi-step flows work** — each adapter keeps its page open between calls.
- **Applicant profile** — save name/address/household/income once with the
  `identity_set_profile` tool; adapters prefill forms from it. Stored encrypted
  with an OS-keychain key. Full SSNs are refused, always.
- **Multiple people** — `CIVIC_MCP_IDENTITY=mom` keeps a family member's or
  client's data fully separate. Built for caseworkers and benefits navigators.

Built-in tools: `identity_get_profile`, `identity_set_profile`, `session_reset`.
Full details: [docs/identity.md](docs/identity.md).

---

## Available Adapters

All adapters are community-tier. Statuses below say whether selectors have been
verified against the live site via the
[verify-live workflow](.github/workflows/verify-live.yml).

### State Benefits

| Adapter | State | Programs | Status |
|---------|-------|----------|--------|
| [`gov.california.benefitscal`](adapters/gov.california.benefitscal) | California | CalFresh, CalWORKs, Medi-Cal (official portal) | 🧪 Community (selectors unverified) |
| [`gov.california.getcalfresh`](adapters/gov.california.getcalfresh) | California | CalFresh (SNAP) via third-party nonprofit site | 🧪 Community (selectors unverified) |
| [`gov.colorado.peak`](adapters/gov.colorado.peak) | Colorado | SNAP, Medicaid, Colorado Works, CHP+ | 🧪 Community (selectors unverified) |
| [`gov.michigan.bridges`](adapters/gov.michigan.bridges) | Michigan | SNAP, Medicaid, Cash | 🧪 Community (selectors unverified) |
| [`gov.texas.yourtexasbenefits`](adapters/gov.texas.yourtexasbenefits) | Texas | SNAP, TANF, Medicaid, CHIP | 🧪 Community (selectors unverified) |

### Federal Services

| Adapter | Agency | Services | Status |
|---------|--------|----------|--------|
| [`gov.ssa.retirement`](adapters/gov.ssa.retirement) | Social Security Administration | Retirement benefit estimates, application start | ✅ Live-verified 2026-06-10 ([CI run](https://github.com/ctrimm/civic-mcp/actions/runs/27248526562)) |

**[Request an adapter →](https://github.com/ctrimm/civic-mcp/issues)**

---

## Repository Structure

```
civic-mcp/
├── packages/
│   ├── mcp-server/         # ★ The MCP server — exposes all adapters to
│   │                       #   Claude Desktop, Cursor, and any MCP client
│   │                       #   over stdio JSON-RPC; drives Playwright
│   ├── sdk/                # Adapter development SDK + shared types
│   ├── cli/                # civic-mcp CLI for adapter development
│   ├── testing/            # Test harness for adapter authors
│   └── extension/          # EXPERIMENTAL Chrome extension (see below)
├── adapters/               # Community-contributed site adapters
│   ├── gov.california.benefitscal/
│   ├── gov.ssa.retirement/
│   └── .../
├── registry/               # Adapter registry metadata
│   ├── registry.json       # Master adapter list
│   └── verified.json       # Verified publishers (empty — no process yet)
├── docs/                   # Documentation (identity.md, ...)
└── scripts/                # Build and maintenance scripts
```

---

## Writing an Adapter

An adapter is a directory under `adapters/` with a `manifest.json` and an
`adapter.ts` that default-exports tools:

```typescript
// adapters/gov.example.benefits/adapter.ts
import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const adapter: AdapterModule = {
  id: 'gov.example.benefits',
  tools: [
    {
      name: 'check_eligibility',
      description: 'Pre-screen eligibility for state benefits',
      inputSchema: {
        type: 'object',
        properties: {
          householdSize: { type: 'number', minimum: 1 },
          monthlyIncome: { type: 'number', minimum: 0 },
        },
        required: ['householdSize', 'monthlyIncome'],
      },
      async execute(params, context): Promise<ToolResult> {
        const { page } = context;
        await page.navigate('https://benefits.example.gov/screener', {
          waitForSelector: 'form#screener',
        });
        await page.fillField('input[name="household_size"]', String(params.householdSize));
        await page.fillField('input[name="monthly_income"]', String(params.monthlyIncome));
        await page.click('button[type="submit"]', { waitForNavigation: true });
        const message = await page.getText('.result .message');
        // Report what the site says — never compute eligibility locally
        return { success: true, data: { siteReportedResult: message } };
      },
    },
  ],
};

export default adapter;
```

Adapter ground rules:

- **Declare `securityLevel`** (`read_only` | `write`) for every tool in the
  manifest — it maps to MCP annotations and the write gate.
- **Report, don't compute.** Extract results from the site; hardcoded income
  tables go stale and give people wrong answers about their benefits.
- **Pause for humans** at logins, CAPTCHAs, and before anything is submitted
  (`page.waitForHuman()`).
- **Never handle full SSNs.** The identity store refuses them; tools that need
  one must hand the browser to the human.

Scaffold and validate with the CLI:

```bash
node packages/cli/bin/civic-mcp create adapter   # scaffold
node packages/cli/bin/civic-mcp validate adapters/gov.newstate.portal/
```

---

## Security Model

### Write gating

Tools that fill or submit real applications are declared `securityLevel: "write"`
in the adapter manifest. They are:

1. advertised to MCP clients with `destructiveHint` annotations, **and**
2. refused by the server unless it was started with `CIVIC_MCP_ALLOW_WRITE=1`.

Read-only tools (eligibility screeners, status checks, benefit estimates) run
without the flag.

### PII rules

- Applicant data lives only in the local, per-identity store — encrypted with an
  OS-keychain key, `0700`/`0600` permissions ([details](docs/identity.md)).
- Full SSNs are **never stored**; only `ssnLast4` is accepted.
- Adapters get read-only access to the applicant profile; only the user (via the
  `identity_set_profile` tool) can write it.

### Adapter trust levels

| Level | Who | Review | Current count |
|-------|-----|--------|---------------|
| 🔵 **Official** | Government agencies | Audit + digital signature | 0 |
| 🟢 **Verified** | Known civic tech orgs | Code review by maintainers | 0 — no verification process exists yet |
| 🟡 **Community** | Anyone | Automated checks (`civic-mcp validate`) | 6 |

### Reporting security issues

Report vulnerabilities privately via [SECURITY.md](SECURITY.md). Do **not** open public issues for security bugs.

---

## Experimental: Chrome extension + WebMCP

`packages/extension/` contains an experimental Chrome (MV3) extension built on
the [WebMCP](https://webmachinelearning.github.io/webmcp/) draft standard
(`navigator.modelContext`, behind a flag in Chrome 146+). It is **not functional
end-to-end yet** — known structural gaps include adapter delivery/compilation,
cross-navigation orchestration, and Chrome Web Store remote-code policy. The MCP
server is the supported path today; the extension is the long-term bet for when
WebMCP ships broadly.

The MCP server also injects an experimental **WebMCP polyfill stub** into pages
it drives: when a government site starts registering its own
`navigator.modelContext` tools, civic-mcp logs it — and bridging those native
tools straight to MCP becomes the upgrade path.

---

## Contributing

We welcome all kinds of contributions.

**Contribute an adapter** — the highest-impact contribution. The most valuable
PR right now is *verifying an existing adapter's selectors against the live
site* and fixing what's broken.

**Improve the MCP server or SDK** — see open [GitHub Issues](https://github.com/ctrimm/civic-mcp/issues).

**[Full contribution guide →](CONTRIBUTING.md)**

---

## Why AGPL-3.0?

Government services are public goods. The software that makes them more accessible should remain a public good too.

AGPL ensures that anyone who deploys civic-mcp as a networked service — including government vendors and SaaS providers — must contribute their improvements back to the commons. MIT or Apache would allow a vendor to fork this, add proprietary adapters, and sell access to them, recreating exactly the lock-in we're trying to break.

AGPL closes that door. Individual users and government agencies running the tools locally are unaffected — the license only activates when you run a modified version as a service for others.

---

## Roadmap

| Milestone | Status |
|-----------|--------|
| Standalone MCP server (annotations, write gating, identities) | ✅ Built — needs live-site verification |
| First adapter verified end-to-end against a live site | ✅ gov.ssa.retirement, 2026-06-10 ([CI run](https://github.com/ctrimm/civic-mcp/actions/runs/27248526562)) |
| SDK, CLI, test harness | ✅ Built |
| Live selector verification for all 6 adapters | 🚧 Planned |
| Adapter verification process + verified tier | 🚧 Planned |
| WebMCP polyfill → full MCP bridge | 🧪 Stub shipped, bridge planned |
| Chrome extension (WebMCP) functional end-to-end | 🧪 Experimental |
| 25 state adapters | 🚧 Planned |

---

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/) — the protocol this server speaks
- [WebMCP Specification](https://webmachinelearning.github.io/webmcp/) — W3C draft standard the extension builds on
- [mcp-b / chrome-devtools-mcp](https://github.com/WebMCP-org/chrome-devtools-quickstart) — Chrome DevTools bridge for WebMCP
- [Code for America](https://codeforamerica.org) — civic tech ecosystem
- [Nava PBC](https://navapbc.com) — government digital services

---

## License

Copyright © 2026 civic-mcp contributors

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [LICENSE](LICENSE) for more details.

---

*civic-mcp is an independent open source project. It is not affiliated with, endorsed by, or operated by any government agency.*
