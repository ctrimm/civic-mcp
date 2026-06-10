# Colorado PEAK Benefits Adapter

WebMCP tools for Colorado PEAK — the state portal for SNAP, Medicaid, Colorado Works, and CHP+.

- **Site**: https://peak.my.site.com (Salesforce Experience Cloud)
- **Trust level**: Verified
- **Author**: Nava PBC
- **Last verified**: 2026-02-17

## Tools

### `gov.colorado.peak.check_program_eligibility`

Run the PEAK pre-screener to estimate eligibility. **No login required.**

| Input | Type | Required | Description |
|---|---|---|---|
| `householdSize` | number | ✅ | Number of people in household |
| `monthlyGrossIncome` | number | ✅ | Total monthly gross income (before taxes) |
| `hasElderly` | boolean | — | Household member with disability or 60+ |
| `hasChildren` | boolean | — | Children under 18 in household |
| `pregnant` | boolean | — | Pregnant household member |

**Output:** `estimatedSnapEligible`, `snapGrossIncomeLimit`, `snapResult`, `medicaidResult`, `coloradoWorksResult`, `note`

### `gov.colorado.peak.start_snap_application`

Begin a new SNAP application. **Requires PEAK login.**

| Input | Type | Required | Description |
|---|---|---|---|
| `firstName` | string | ✅ | First name |
| `lastName` | string | ✅ | Last name |
| `dateOfBirth` | string | ✅ | MM/DD/YYYY |
| `address` | object | ✅ | `{street, city, zip}` |
| `programs` | string[] | — | `["SNAP", "Medicaid", "ColoradoWorks", "CHP+"]` |

**Output:** `applicationId`, `programs`, `nextStep`, `note`

### `gov.colorado.peak.check_application_status`

Check status of an existing application. **Requires PEAK login.**

| Input | Type | Required | Description |
|---|---|---|---|
| `applicationId` | string | — | Application number (optional if only one exists) |

**Output:** `status`, `program`, `lastUpdated`, `nextAction`

### `gov.colorado.peak.get_peak_page_info`

Return info about the current PEAK page. No login required.

**Output:** `currentUrl`, `pageTitle`, `isLoggedIn`

## Technical Notes

- PEAK runs on Salesforce Experience Cloud (LWC). Selectors pierce Shadow DOM where possible using standard CSS fallbacks.
- If the screener tool fails to find form fields, it falls back to a client-side income-based estimate using 2024 federal poverty level thresholds.
- Authenticated tools will return `AUTH_REQUIRED` if the user is not logged in.

## Testing

```bash
civic-mcp test
```

Tests run against the live site. The eligibility screener test does not require login.
Authenticated tests are marked `skip` and must be run manually with a valid session.

Last tested: 2026-02-17
