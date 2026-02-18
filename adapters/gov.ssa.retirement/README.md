# Social Security Retirement Benefits — Adapter

**Adapter ID:** `gov.ssa.retirement`
**Sites:** `www.ssa.gov` · `secure.ssa.gov`
**Trust level:** Verified

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

### `start_retirement_application`

Navigates to the SSA online retirement application (`secure.ssa.gov/iClaim/rib`), fills
personal information autonomously, then **pauses for a human to solve a reCAPTCHA** before
submitting.

This tool is the canonical example of the `waitForHuman()` API. SSA has required a
reCAPTCHA on the retirement application since 2023; it cannot be bypassed programmatically.

| Input | Type | Required | Description |
|---|---|---|---|
| `dateOfBirth` | string | Yes | `MM/DD/YYYY` format |
| `firstName` | string | Yes | Legal first name |
| `lastName` | string | Yes | Legal last name |
| `phone` | string | Yes | 10-digit phone (digits only) |
| `claimMonth` | string | No | e.g. `"January 2026"` |

**Output:**
```json
{
  "confirmationNumber": "24NHB0005309",
  "nextSteps": "SSA will mail a letter within 5–7 business days.",
  "applicationUrl": "https://secure.ssa.gov/iClaim/rib/confirmation"
}
```

---

## Running for a demo video

### Step 1 — Start headed mode

```bash
CIVIC_MCP_HEADED=1 pnpm --filter @civic-mcp/testing exec vitest run \
  adapters/gov.ssa.retirement
```

A Chromium window opens. The test suite runs automatically:

1. **Estimate tool** — fills the Quick Calculator form and reads results back. No interaction
   needed from you.
2. **Application tool** — navigates to `secure.ssa.gov`, fills name / DOB / phone. When the
   reCAPTCHA iframe appears the adapter calls `waitForHuman()`:
   - **In the terminal:** the prompt is printed and execution pauses.
   - **In the browser:** the partially-filled form is visible with the reCAPTCHA checkbox.

### Step 2 — Solve the CAPTCHA

Click the "I'm not a robot" checkbox (or complete the image challenge if prompted).

### Step 3 — Resume

Press **Enter** in the terminal. The adapter submits the form and prints the confirmation number.

### Using the extension popup instead

When running via the Chrome extension (not the test harness), the `waitForHuman()` overlay
appears automatically in the popup — no terminal interaction needed. That path is ideal for
a polished demo:

1. Open the Civic-MCP popup.
2. Trigger the `start_retirement_application` tool from your AI assistant.
3. The popup dims and shows: _"SSA requires a reCAPTCHA before submitting your application…"_
4. Solve the CAPTCHA in the tab.
5. Click **Done — continue** in the popup.
6. The AI assistant receives the confirmation number.

---

## Human-in-the-loop API — how it works

```typescript
// In the adapter:
await context.page.waitForHuman({
  prompt:
    'SSA requires a reCAPTCHA before submitting your application.\n\n' +
    '1. Look at the browser window — a "I\'m not a robot" checkbox should be visible.\n' +
    '2. Complete the reCAPTCHA challenge.\n' +
    '3. Click "Done — continue" here once the checkmark appears.',
  timeout: 10 * 60 * 1_000, // 10 minutes
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
