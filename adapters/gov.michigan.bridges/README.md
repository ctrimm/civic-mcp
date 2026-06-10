# Michigan MI Bridges Adapter

WebMCP tools for [Michigan MI Bridges](https://newmibridges.michigan.gov) — the state portal for SNAP (FAP), Medicaid, and Cash Assistance (FIP).

- **Site**: https://newmibridges.michigan.gov
- **Trust level**: Community (pending Verified review)
- **Author**: Community Contributor
- **Last verified**: 2026-02-17

## Tools

### `gov.michigan.bridges.check_eligibility`

Run the MI Bridges pre-screener. **No login required.**

| Input | Type | Required | Description |
|---|---|---|---|
| `householdSize` | number | ✅ | People in household |
| `monthlyGrossIncome` | number | ✅ | Monthly gross income in dollars |
| `hasChildren` | boolean | — | Children under 18 |
| `hasDisability` | boolean | — | Household member with disability |
| `county` | string | — | Michigan county name |

**Output:** `snapResult`, `medicaidResult`, `cashAssistanceResult`, `overallMessage`, `note`

### `gov.michigan.bridges.start_application`

Begin a Michigan benefits application. **Requires MI Bridges login.**

| Input | Type | Required | Description |
|---|---|---|---|
| `firstName` | string | ✅ | |
| `lastName` | string | ✅ | |
| `dateOfBirth` | string | ✅ | MM/DD/YYYY |
| `programs` | string[] | — | `["SNAP", "Medicaid", "Cash", "SDA"]` |

**Output:** `applicationId`, `programs`, `nextStep`

### `gov.michigan.bridges.check_application_status`

Check application status. **Requires login.**

**Output:** `status`, `lastUpdated`, `applicationId`

## Technical Notes

- MI Bridges uses an Angular SPA. The adapter adds a 500ms wait after navigation for Angular hydration.
- Community trust level — selectors have not gone through full Verified review. Report issues via GitHub.

## Testing

```bash
civic-mcp test
```

Last tested: 2026-02-17
