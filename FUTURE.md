# Future Work

Backlog of adapters and platform work, in rough priority order. Items move
out of this file when they're built **and live-verified** (see the
[verify-live workflow](.github/workflows/verify-live.yml) — the probe-first
loop is documented in each verified adapter's README).

---

## Adapters

### Texas — YourTexasBenefits (`gov.texas.yourtexasbenefits`)
The existing adapter still has **unverified selectors** (best-effort guesses
against a React SPA). Next steps, same loop as Michigan/Colorado:
1. Probe `https://www.yourtexasbenefits.com/Learn/Home` (and the root) with
   the form-dump script to find real entry points for the prescreener
   ("Am I eligible?"), application start, and login.
2. Rewrite tools around verified entry points; keep deep wizard flows as
   reported-content or human handoff until mapped.
3. Add to the `ADAPTER` list in verify-live.yml.

### Driving the screeners end-to-end (existing adapters)
Several verified adapters open interactive screeners but don't answer the
questions yet — each needs its wizard steps probed and mapped:
- **Colorado PEAK benefits finder** — map the category checkbox codes
  (`BF GC GJ SC GS PC GH MH SS CE PH PB GR`) to labels, then drive
  selections → results.
- **BenefitsCal "Do I Qualify"** — map the screener questions behind
  `#HomePage_doIQualify_btn` (Angular routes).
- **IRS Withholding Estimator** — map the Income → Deductions → Credits →
  Results steps (income page is dynamic per number of jobs). Page-1 is done.
- **Medicare late-penalty calculator** — `#btnPremium` flow shares the DOB
  fields (`form#premiumForm`); map its follow-up questions.

### StudentAid estimator automation (`gov.studentaid.estimator`)
`studentaid.gov` blocks datacenter IPs, so CI can't probe it. Needs someone
on a residential connection to run
`pnpm --filter @civic-mcp/testing exec node scripts/dump-form-html.mjs https://studentaid.gov/aid-estimator`
and contribute the wizard selectors. Until then the adapter is handoff-only.

### New adapter candidates (probe-first, in priority order)
- **USAGov Benefit Finder** (`usa.gov/benefit-finder`) — the successor to
  Benefits.gov (decommissioned Sept 2024). Multi-step React wizard; the
  federal multi-program screener would be the highest-leverage single adapter.
- **SSA disability (SSDI/SSI) starter kit pages** — same ssa.gov trust level
  as the already-verified retirement tools.
- **Medicare plan finder** (`medicare.gov/plan-compare`) — large SPA, high
  value for open-enrollment season.
- **State unemployment insurance portals** — high churn/login walls; treat as
  login-handoff + status-report tools like PEAK/MI Bridges.
- **VA.gov benefits** — has a real public API (`api.va.gov`, needs API key),
  which may fit better as a non-browser adapter; design question below.

## Platform

- **Non-browser (API) adapters** — VA and api.weather.gov style JSON APIs
  don't need Playwright. Decide whether the SDK grows a `fetch`-style context
  (scoped to manifest domains) or API integrations stay out of scope.
- **Scheduled drift detection** — add a weekly `schedule:` trigger to
  verify-live.yml so selector rot on verified adapters is caught without a
  push. Open an issue automatically on failure.
- **Screener answer mapping convention** — several sites present multi-step
  wizards; define a declarative step/question schema so wizard flows can be
  contributed as data rather than code.
- **Identity hardening** (CONCERNS.md §5) — passphrase-derived key fallback
  for keychainless systems; encrypt adapter storage, not just the profile.
- **Per-adapter page queuing** (CONCERNS.md §6) — serialize concurrent tool
  calls that share an adapter page.
- **WebMCP polyfill → MCP bridge** — the stub currently logs page-registered
  tools; bridge them to MCP when a government site actually ships WebMCP.
- **Extension revival** (see `packages/extension/README.md`) — blocked on
  adapter bundling, service-worker orchestration, and verifying
  `navigator.modelContext` access from content scripts in Chrome Canary.
- **Registry verification process** — `verified.json` is intentionally empty;
  define what review a "verified" tier actually requires before using it.
