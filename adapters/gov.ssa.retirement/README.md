# Social Security Retirement Benefits — Adapter

**Adapter ID:** `gov.ssa.retirement`
**Sites:** `www.ssa.gov` · `secure.ssa.gov`
**Trust level:** Community
**Last verified:** 2026-06-10 — all 12 live tests passed against production ssa.gov in CI ([run 27268888303](https://github.com/ctrimm/civic-mcp/actions/runs/27268888303)): benefit estimator, life expectancy calculator, office locator, and the application handoff

---

## Tools

### `estimate_retirement_benefit`

Uses the [SSA Quick Calculator](https://www.ssa.gov/OACT/quickcalc/) to estimate your monthly
retirement benefit at three claiming ages.

**Runs fully autonomously — no login or human interaction required.**

| Input | Type | Required | Description |
|---|---|---|---|
| `birthYear` | number | Yes | Four-digit birth year (e.g. `1965`) |
| `currentAnnualEarnings` | number | Yes | Current annual earnings before taxes |
| `plannedRetirementYear` | number | No | Year you plan to stop working |

**Output:**
```json
{
  "estimatedMonthlyBenefit": {
    "atAge62":             1420,
    "atFullRetirementAge": 2014,
    "atAge70":             2538
  },
  "fullRetirementAge": "67",
  "birthYear": 1965,
  "note": "Estimates are in today's dollars...",
  "source": "SSA Quick Calculator — https://www.ssa.gov/OACT/quickcalc/"
}
```

---

### `estimate_life_expectancy`

Drives the [SSA Life Expectancy Calculator](https://www.ssa.gov/OACT/population/longevity.html)
(sex + date of birth → average additional life expectancy from SSA actuarial
tables). Useful when weighing claiming ages. Selectors were captured from the
live form HTML by the verify-live probe — note the month values are 0-based
and the day list is JS-populated.

| Input | Type | Required |
|---|---|---|
| `sex` | `"male"` / `"female"` | Yes |
| `birthMonth` | number (1–12) | Yes |
| `birthDay` | number (1–31) | Yes |
| `birthYear` | number (1908–2026) | Yes |

---

### `find_local_office`

Searches the [SSA Field Office Locator](https://www.ssa.gov/locator) by ZIP,
city, or address and returns the site-reported office details. (The old
`secure.ssa.gov/ICON` locator now redirects here.)

---

### `start_retirement_application`

Opens the SSA online retirement application (`secure.ssa.gov/iClaim/rib`) and
**hands the browser to the human**. SSA requires identity verification through
Login.gov or ID.me, and the application asks for a full SSN — both things an
agent must never automate. The tool navigates there, pauses with
`waitForHuman()`, and reports back when the user says they're done.

> The previous version of this tool claimed to fill and submit the application
> autonomously and return a confirmation number. The live CI run on 2026-06-10
> proved those selectors never existed on the real page; the flow was removed.

No inputs. **Output:**
```json
{
  "applicationUrl": "https://secure.ssa.gov/iClaim/rib",
  "note": "Browser was handed to the user for the application. Nothing was filled or submitted by the agent."
}
```

---

## Running headed (interactive)

```bash
CIVIC_MCP_HEADED=1 pnpm exec vitest run adapters/gov.ssa.retirement
```

A Chromium window opens:

1. **Estimate tool** — fills the Quick Calculator form and reads results back
   automatically. No interaction needed (verified live 2026-06-10).
2. **Application tool** — opens the application entry page and pauses. Sign in
   and complete (or abandon) the application yourself, then press **Enter** in
   the terminal to resume.

---

## Human-in-the-loop API — how it works

```typescript
// In the adapter:
await context.page.waitForHuman({
  prompt:
    'The SSA retirement application is open in the browser.\n\n' +
    '1. Sign in with Login.gov or ID.me (or create an account).\n' +
    '2. Complete the application steps yourself.\n' +
    '3. Click "Done — continue" here when you have finished.',
  timeout: 30 * 60 * 1_000, // 30 minutes
});
```

**Extension runtime:** writes a pending request to `chrome.storage.local`. The popup's
`chrome.storage.onChanged` listener picks it up and renders the overlay. Clicking "Done"
marks the request completed in storage, which unblocks the adapter's polling loop.

**Test harness — headed:** prints the prompt to `stdout` and awaits `readline` Enter.

**Test harness — headless / CI:** throws `HumanRequiredError` immediately. Tests catch it
and skip rather than fail:

```typescript
import { HumanRequiredError } from '@civic-mcp/testing';

try {
  await harness.testTool('start_retirement_application', params);
} catch (err) {
  if (err instanceof HumanRequiredError) return; // skip in CI
  throw err;
}
```

---

## Manifest permissions

This adapter declares `"human-in-the-loop"` in `permissions.required` because
`start_retirement_application` calls `waitForHuman()`. The `civic-mcp validate` command
will warn if this permission is missing.

```json
"permissions": {
  "required": ["read:forms", "write:forms", "navigate", "human-in-the-loop"]
}
```
