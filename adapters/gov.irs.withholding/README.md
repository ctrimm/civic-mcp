# IRS Tax Withholding Estimator Adapter

Drives the official [IRS Tax Withholding Estimator](https://apps.irs.gov/app/tax-withholding-estimator).

- **Author**: civic-mcp contributors
- **Trust level**: Community
- **Selectors**: About-you page captured from live app HTML 2026-06-10 (probe run [27269590345](https://github.com/ctrimm/civic-mcp/actions/runs/27269590345))

## Tools

### `start_withholding_estimate` (read-only)
Completes the estimator's "About you" step (filing status + the four yes/no
questions) and reports what the Income step asks, so the user knows which pay
stubs and figures to gather. Nothing is filed with the IRS — the estimator is
an anonymous calculator.

The wizard's remaining steps (income → deductions → credits → results) are not
yet automated; the Income page's fields are dynamic per number of jobs.
Mapping them via the verify-live probe is the follow-up.

## Gotchas

- Field ids contain slashes (`/filingStatus-single`) — CSS attribute selectors
  required.
- `apps.irs.gov` rejects HTTP/2 from some datacenter IPs; a real Chromium
  works, plain `fetch` may not.
