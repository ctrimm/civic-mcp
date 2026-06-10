# GetCalFresh Adapter

Information about applying for CalFresh (SNAP) in California via
[getcalfresh.org](https://www.getcalfresh.org) — a site operated by a
third-party nonprofit (no affiliation with this project).

- **Author**: civic-mcp contributors
- **Trust level**: Community
- **Last verified**: 2026-06-10 (probe run [27269590345](https://github.com/ctrimm/civic-mcp/actions/runs/27269590345))

## Reality check (2026-06-10)

GetCalFresh **no longer hosts a prescreener or application**. The old
`/en/prescreen` and `/en/apply` paths redirect to the informational homepage
(zero forms), and every apply link routes to California's official portal at
`benefitscal.com/ApplyForBenefits/begin/ABOVR`. The previous
`check_eligibility` and `start_application` tools drove forms that no longer
exist and were removed.

## Tools

### `get_application_info` (read-only)
Reports what getcalfresh.org currently says about the CalFresh application
process, plus the official BenefitsCal apply URL. To actually apply, use the
[`gov.california.benefitscal`](../gov.california.benefitscal) adapter.
