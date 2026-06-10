/**
 * California GetCalFresh Adapter
 *
 * Target site: https://www.getcalfresh.org
 * Note: getcalfresh.org is operated by a third-party nonprofit (not a government
 *       agency). This community adapter is not affiliated with or endorsed by them.
 *
 * REALITY CHECK (live probe, 2026-06-10, CI run 27269590345): GetCalFresh no
 * longer hosts its own prescreener or application. Every "apply" link on the
 * site routes to California's official portal:
 *   https://benefitscal.com/ApplyForBenefits/begin/ABOVR
 * The old /en/prescreen and /en/apply paths redirect to the informational
 * homepage, which has zero forms. The previous check_eligibility and
 * start_application tools in this adapter drove forms that no longer exist.
 *
 * This adapter is now informational: it reports what the site says about the
 * CalFresh application steps and hands back the official apply URL. For the
 * actual application, use the gov.california.benefitscal adapter.
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const OFFICIAL_APPLY_URL = 'https://benefitscal.com/ApplyForBenefits/begin/ABOVR?lang=en';

const adapter: AdapterModule = {
  id: 'gov.california.getcalfresh',

  tools: [
    {
      name: 'get_application_info',
      description:
        'Get current information about applying for CalFresh (SNAP) in California from ' +
        'getcalfresh.org — what to expect, how applying works — plus the official ' +
        'application URL. GetCalFresh no longer hosts applications itself; applying ' +
        'happens on BenefitsCal (see the gov.california.benefitscal adapter).',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page } = context;
        try {
          await page.navigate('https://www.getcalfresh.org/en/', {
            waitForSelector: 'main, body',
            timeout: 25_000,
          });

          const infoText = (await page.getText('main')) ?? (await page.getText('body')) ?? '';

          return {
            success: true,
            data: {
              siteReportedInfo: infoText.replace(/\s+/g, ' ').trim().slice(0, 2_500),
              officialApplyUrl: OFFICIAL_APPLY_URL,
              note:
                'getcalfresh.org is informational only — applications happen on BenefitsCal, ' +
                "California's official portal. Use the gov.california.benefitscal adapter to apply.",
              source: 'https://www.getcalfresh.org/en/',
            },
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            code: 'UNKNOWN',
          };
        }
      },
    },
  ],
};

export default adapter;
