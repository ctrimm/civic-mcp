# Michigan MI Bridges Adapter

Tools for [MI Bridges](https://newmibridges.michigan.gov) — Michigan's portal
for SNAP (Food Assistance Program), Medicaid, and cash assistance.

- **Author**: civic-mcp contributors
- **Trust level**: Community
- **Last verified**: 2026-06-10 — entry points verified via live CI probes
  ([27271075100](https://github.com/ctrimm/civic-mcp/actions/runs/27271075100),
  [27271379213](https://github.com/ctrimm/civic-mcp/actions/runs/27271379213))

> The previous version of this adapter drove hardcoded paths
> (`/s/isd-check-benefits`, `/s/isd-apply-benefits`) that were never verified.
> It now uses click-through flows from the verified landing page buttons.

## Tools

### `explore_resources` (read-only)
Opens MI Bridges "Explore Resources" (`/s/isd-explore-resources`) — the
directory of state and community assistance programs — and reports its
content. No login required. Live-verified headless.

### `start_application` (write, human handoff)
Clicks the verified guest-application button (routes to
`/s/isd-external-afb-screen`) and hands the browser to the user for the
screening questions and application. Nothing is filled or submitted by the
agent. Requires `CIVIC_MCP_ALLOW_WRITE=1`.

### `check_application_status` (read-only, login handoff)
Opens the login flow, pauses for the user to sign in, then reports the
dashboard content. The session persists in the active identity's browser
profile.
