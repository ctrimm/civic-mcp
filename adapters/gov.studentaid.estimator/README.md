# Federal Student Aid Estimator Adapter

Opens the official [Federal Student Aid Estimator](https://studentaid.gov/aid-estimator) — the pre-FAFSA federal aid preview.

- **Author**: civic-mcp contributors
- **Trust level**: Community

## Why this adapter is handoff-only

`studentaid.gov` blocks datacenter IPs: GitHub-hosted runners get HTTP/2
protocol errors and timeouts (verified 2026-06-10, CI runs
[27269295403](https://github.com/ctrimm/civic-mcp/actions/runs/27269295403) /
[27269590345](https://github.com/ctrimm/civic-mcp/actions/runs/27269590345)).
That means the estimator wizard can't be probed or selector-verified from CI —
and unverified selector automation is exactly what this project refuses to
ship. From a user's residential connection the site loads fine, so the tool
navigates there and hands the browser to the user.

**To upgrade this adapter:** run the form-dump probe from a residential
connection (`pnpm --filter @civic-mcp/testing exec node scripts/dump-form-html.mjs https://studentaid.gov/aid-estimator`),
map the wizard, and contribute the selectors.

## Tools

### `open_aid_estimator` (read-only, human handoff)
Navigates to the estimator and pauses with `waitForHuman()` while the user
completes the ~10-minute wizard. Nothing is filed.

## Testing

CI skips the live test (blocked IP). Locally:

```bash
CIVIC_MCP_STUDENTAID_LIVE=1 CIVIC_MCP_HEADED=1 pnpm exec vitest run adapters/gov.studentaid.estimator
```
