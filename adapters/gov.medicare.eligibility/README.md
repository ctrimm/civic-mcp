# Medicare Eligibility Calculator Adapter

Drives the official [Medicare.gov eligibility & premium calculator](https://www.medicare.gov/eligibilitypremiumcalc).

- **Author**: civic-mcp contributors
- **Trust level**: Community
- **Selectors**: captured from live form HTML 2026-06-10 (probe run [27269590345](https://github.com/ctrimm/civic-mcp/actions/runs/27269590345))

## Tools

### `check_medicare_eligibility` (read-only)
Date of birth + "worked 10+ years paying Medicare taxes" → the calculator's
eligibility-date and premium estimate, reported exactly as the site presents
it. No login, no CAPTCHA, fully autonomous.

A `#btnPremium` flow (Part B late-enrollment penalty calculator) exists on the
same page and is a candidate follow-up tool — its first screen reuses the same
DOB fields (`form#premiumForm`).
