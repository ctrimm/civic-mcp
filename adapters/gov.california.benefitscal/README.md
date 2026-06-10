# California BenefitsCal Adapter

Tools for [BenefitsCal](https://benefitscal.com) — California's **official**
portal for CalFresh (SNAP), CalWORKs, Medi-Cal, and General Assistance.

- **Author**: civic-mcp contributors
- **Trust level**: Community
- **Last verified**: never (selectors unverified)

> ⚠️ Selectors in this adapter are best-effort and have **not** been verified
> against the live site. Verify and update before relying on it, and report
> breakage at <https://github.com/ctrimm/civic-mcp/issues>.

## Tools

### `check_eligibility` (read-only)
Runs the "Am I eligible?" pre-screener. No login required. Returns the
programs the **site** reports the household may qualify for — this adapter
never computes eligibility from hardcoded income tables.

### `get_case_status` (read-only, login required)
Opens the case dashboard. On first use the browser pauses (`waitForHuman`)
so the user can sign in — including any SMS/email verification code — and the
session is then remembered in the active identity's browser profile, so
subsequent calls don't need to log in again.

### `start_application` (write)
Begins a new application and prefills contact fields from the identity's
saved applicant profile (`identity_set_profile`). It **never submits
autonomously**: the flow always pauses for the human to review, complete, and
submit the application themselves. Requires `CIVIC_MCP_ALLOW_WRITE=1`.

## Identity integration

This is the first adapter to use `context.identity.getProfile()` — save a
profile once with the `identity_set_profile` MCP tool and contact fields are
prefilled on every new application. See `docs/identity.md`.
