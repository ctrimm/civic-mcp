# Colorado PEAK Adapter

Tools for [Colorado PEAK](https://peak.my.site.com/peak/s/afb-welcome) — the
state's portal for SNAP, Health First Colorado (Medicaid), Colorado
Works/TANF, and CHP+.

- **Author**: civic-mcp contributors
- **Trust level**: Community
- **Last verified**: 2026-06-10 — public routes verified via live CI probe
  ([27271735544](https://github.com/ctrimm/civic-mcp/actions/runs/27271735544))

> The site roots (`/` and `/peak/s/`) redirect to login, but the deep routes
> this adapter uses are public. The previous version drove hardcoded paths
> (`afb-program-information`, `afb-application`) that were never verified.

## Tools

### `find_benefits` (read-only)
Opens the "Find benefits" directory (`/peak/s/benefit-information`) and
reports program descriptions. Live-verified headless.

### `open_benefits_finder` (read-only)
Opens the interactive benefits finder (`/peak/s/get-help-finding-benefits`,
category checkboxes for food/health/cash/housing/child-care) and reports what
it asks. Mapping the checkbox category codes (BF, GC, GJ, …) to labels so the
finder can be driven end-to-end is a known follow-up.

### `start_application` (write, human handoff)
Opens `/peak/s/afb-welcome` and clicks the verified `ApplyAsGuest` button,
then hands the browser to the user. Nothing is filled or submitted by the
agent. Requires `CIVIC_MCP_ALLOW_WRITE=1`.

### `check_application_status` (read-only, login handoff)
Clicks the verified `SignIn` button, pauses for login, then reports the
dashboard content. The session persists in the active identity's browser
profile.
