/**
 * IRS Tax Withholding Estimator Adapter
 *
 * Target site: https://apps.irs.gov/app/tax-withholding-estimator
 *
 * Page-1 ("About you") markup captured from the live app on 2026-06-10
 * (CI run 27269590345). The app uses fact-graph field names with slashes:
 *   [id='/filingStatus-single'], [id='/primaryFilerAge65OrOlder-yes'], …
 * Note: apps.irs.gov rejects HTTP/2 from some datacenter IPs — the MCP
 * server's Chromium works; plain fetch may not.
 *
 * The estimator is a multi-step wizard (about you → income → deductions →
 * credits → results). This v1 tool completes step 1 autonomously and reports
 * what step 2 asks, so the AI can gather the right info from the user.
 * Driving the full wizard to results is the follow-up.
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const APP_URL = 'https://apps.irs.gov/app/tax-withholding-estimator';

type FilingStatus =
  | 'single'
  | 'marriedFilingJointly'
  | 'marriedFilingSeparately'
  | 'headOfHousehold'
  | 'qualifiedSurvivingSpouse';

const adapter: AdapterModule = {
  id: 'gov.irs.withholding',

  tools: [
    {
      name: 'start_withholding_estimate',
      description:
        'Start the official IRS Tax Withholding Estimator: completes the "About you" ' +
        'step (filing status, age 65+, blind, dependents) and reports what the Income ' +
        'step asks for, so the user can gather pay stubs and figures. Read-only against ' +
        'IRS systems — nothing is filed. No login required.',
      inputSchema: {
        type: 'object',
        properties: {
          filingStatus: {
            type: 'string',
            description: 'Federal filing status',
            enum: [
              'single',
              'marriedFilingJointly',
              'marriedFilingSeparately',
              'headOfHousehold',
              'qualifiedSurvivingSpouse',
            ],
          },
          age65OrOlder: { type: 'boolean', description: 'Will the filer be 65 or older this tax year?' },
          isBlind: { type: 'boolean', description: 'Is the filer legally blind?' },
          claimingDependents: { type: 'boolean', description: 'Will the filer claim any dependents?' },
          claimedOnAnotherReturn: {
            type: 'boolean',
            description: 'Can someone else claim the filer as a dependent?',
          },
        },
        required: ['filingStatus', 'age65OrOlder', 'isBlind', 'claimingDependents', 'claimedOnAnotherReturn'],
      },

      async execute(
        params: {
          filingStatus: FilingStatus;
          age65OrOlder: boolean;
          isBlind: boolean;
          claimingDependents: boolean;
          claimedOnAnotherReturn: boolean;
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        const { page, utils, notify } = context;

        // Fact-graph ids contain slashes — use attribute selectors.
        // USWDS visually hides the radio <input> off-screen; the <label>
        // is the clickable element (live run 27270279495 proved clicking
        // the input times out with "element is outside of the viewport").
        const radio = (name: string, value: string) => `label[for='/${name}-${value}']`;
        const yn = (v: boolean) => (v ? 'yes' : 'no');

        try {
          notify.info('Loading the IRS Tax Withholding Estimator…');
          await page.navigate(APP_URL, {
            waitForSelector: "[id='/filingStatus-single']",
            timeout: 45_000,
          });

          await page.click(radio('filingStatus', params.filingStatus));
          await utils.sleep(300); // conditional questions render on selection
          await page.click(radio('primaryFilerAge65OrOlder', yn(params.age65OrOlder)));
          await page.click(radio('primaryFilerIsBlind', yn(params.isBlind)));
          await page.click(radio('primaryFilerIsClaimingDependents', yn(params.claimingDependents)));
          await page.click(radio('primaryFilerIsClaimedOnAnotherReturn', yn(params.claimedOnAnotherReturn)));

          // "Next" is an anchor to the income step (captured in the live probe)
          await page.click('a[href*="/income"]', { waitForNavigation: true, timeout: 20_000 });
          await utils.sleep(1_500);

          const incomeStepText =
            (await page.getText('main')) ?? (await page.getText('body')) ?? '';

          return {
            success: true,
            data: {
              completedStep: 'about-you',
              nextStep: 'income',
              nextStepUrl: page.currentUrl(),
              siteReportedNextQuestions: incomeStepText.replace(/\s+/g, ' ').trim().slice(0, 2_500),
              note:
                'About-you step completed on the official IRS estimator. The Income step is ' +
                'now open — gather pay stubs / income figures and continue in the browser, ' +
                'or extend this adapter to drive the remaining steps.',
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
