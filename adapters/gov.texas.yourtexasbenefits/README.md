# Texas YourTexasBenefits Adapter

WebMCP tools for [YourTexasBenefits](https://www.yourtexasbenefits.com) — the Texas HHS portal for SNAP, TANF, Medicaid, and CHIP.

- **Site**: https://www.yourtexasbenefits.com
- **Trust level**: Community (pending Verified review)
- **Author**: Community Contributor
- **Last verified**: 2026-02-17

## Tools

### `gov.texas.yourtexasbenefits.check_eligibility`

Run the pre-screener. **No login required.**

| Input | Type | Required | Description |
|---|---|---|---|
| `householdSize` | number | ✅ | People in household |
| `monthlyGrossIncome` | number | ✅ | Monthly gross income in dollars |
| `hasChildren` | boolean | — | Children under 18 |
| `hasPregnant` | boolean | — | Pregnant household member |
| `hasDisability` | boolean | — | Household member with disability |
| `county` | string | — | Texas county name (e.g. Harris, Dallas) |

**Output:** `snapResult`, `medicaidResult`, `tanfResult`, `chipResult`, `overallMessage`, `note`

### `gov.texas.yourtexasbenefits.start_application`

Begin a Texas benefits application. **Requires YourTexasBenefits login.**

| Input | Type | Required | Description |
|---|---|---|---|
| `firstName` | string | ✅ | |
| `lastName` | string | ✅ | |
| `dateOfBirth` | string | ✅ | MM/DD/YYYY |
| `address` | object | ✅ | `{street, city, zip}` |
| `ssn` | string | — | Last 4 digits of SSN |
| `programs` | string[] | — | `["SNAP", "TANF", "Medicaid", "CHIP"]` |

**Output:** `applicationId`, `programs`, `nextStep`

### `gov.texas.yourtexasbenefits.get_benefit_status`

Check current benefit status. **Requires login.**

| Input | Type | Required | Description |
|---|---|---|---|
| `caseNumber` | string | — | Optional case number |

**Output:** `snapStatus`, `medicaidStatus`, `tanfStatus`, `renewalDate`

## Technical Notes

- YourTexasBenefits uses a React SPA. The adapter adds a 500ms wait for React hydration.
- The pre-screener may redirect through multiple pages to reach the form — the adapter handles this automatically.
- Community trust level. See selectors.json for known fragile selectors.

## Testing

```bash
civic-mcp test
```

Last tested: 2026-02-17
