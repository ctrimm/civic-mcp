/**
 * Federal Student Aid Estimator Adapter
 *
 * Target site: https://studentaid.gov/aid-estimator
 *
 * IMPORTANT LIMITATION (discovered 2026-06-10, CI runs 27269295403 and
 * 27269590345): studentaid.gov rejects connections from datacenter IPs
 * (HTTP/2 protocol errors, then timeouts even with HTTP/1.1), so the
 * verify-live workflow cannot reach it and the estimator wizard cannot be
 * selector-verified from CI. Until someone verifies the wizard from a
 * residential connection, this adapter does the honest minimum: open the
 * estimator and hand the browser to the user.
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const ESTIMATOR_URL = 'https://studentaid.gov/aid-estimator';

const adapter: AdapterModule = {
  id: 'gov.studentaid.estimator',

  tools: [
    {
      name: 'open_aid_estimator',
      description:
        'Open the official Federal Student Aid Estimator (studentaid.gov) in the browser ' +
        'and hand it to the user. The estimator previews federal aid (Pell Grant etc.) ' +
        'before filing the FAFSA — about 10 minutes, no login required. The wizard is ' +
        'completed by the user; nothing is filed.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page } = context;
        try {
          await page.navigate(ESTIMATOR_URL, { timeout: 45_000 });

          await page.waitForHuman({
            prompt:
              'The Federal Student Aid Estimator is open in the browser.\n\n' +
              '1. Answer the wizard questions (student status, household, income).\n' +
              '2. Review the estimated aid summary at the end.\n' +
              '3. Click "Done — continue" here when finished.',
            timeout: 30 * 60 * 1_000,
          });

          return {
            success: true,
            data: {
              currentUrl: page.currentUrl(),
              note: 'Estimator handed to the user. Nothing was filled or filed by the agent.',
            },
          };
        } catch (err) {
          if (err instanceof Error && err.name === 'HumanRequiredError') throw err;
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
