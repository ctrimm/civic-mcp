# California GetCalFresh Adapter

WebMCP tools for [GetCalFresh](https://www.getcalfresh.org) — Code for America's portal for California CalFresh (SNAP) applications.

- **Site**: https://www.getcalfresh.org
- **Trust level**: Verified
- **Author**: Nava PBC / Code for America
- **Last verified**: 2026-02-17

## Tools

### `gov.california.getcalfresh.check_eligibility`

Run the CalFresh pre-screener. **No login required.**

| Input | Type | Required | Description |
|---|---|---|---|
| `zipCode` | string | ✅ | California ZIP code (must start with 9) |
| `householdSize` | number | ✅ | People who buy/prepare food together |
| `monthlyGrossIncome` | number | ✅ | Monthly gross income in dollars |
| `hasElderly` | boolean | — | Household member 60+ or with disability |
| `hasExpenses` | boolean | — | Housing or childcare expenses |

**Output:** `eligible`, `estimatedMonthlyBenefit`, `grossIncomeLimit`, `message`, `zipCode`

Results are cached for 24 hours per unique household profile.

### `gov.california.getcalfresh.start_application`

Begin a CalFresh application. **No login required** (account created during flow).

| Input | Type | Required | Description |
|---|---|---|---|
| `firstName` | string | ✅ | |
| `lastName` | string | ✅ | |
| `phoneNumber` | string | ✅ | 10 digits, no formatting |
| `address` | object | ✅ | `{street, city, zip}` |
| `email` | string | — | Contact email |
| `preferredLanguage` | string | — | `English`, `Spanish`, `Chinese`, `Vietnamese`, `Korean`, `Tagalog` |

**Output:** `applicationId`, `nextStepUrl`, `note`

## Testing

```bash
civic-mcp test
```

The `check_eligibility` test runs against the live site. The `start_application` test is skipped by default — run manually to avoid creating real applications.

Last tested: 2026-02-17
