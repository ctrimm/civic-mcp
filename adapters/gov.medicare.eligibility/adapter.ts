/**
 * Medicare Eligibility Calculator Adapter
 *
 * Target site: https://www.medicare.gov/eligibilitypremiumcalc
 *
 * Form markup captured from the live page on 2026-06-10 (CI run 27269590345):
 *   entry button  #btnEligibility  → SPA route #/eligibility
 *   form#eligibilityForm:
 *     DOB    input#under65__month / #under65__day / #under65__year
 *     FICA   input#fica__choice--0 (yes) / #fica__choice--1 (no)
 *     submit button#btnEligibilitySubmit
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const CALC_URL = 'https://www.medicare.gov/eligibilitypremiumcalc';

const adapter: AdapterModule = {
  id: 'gov.medicare.eligibility',

  tools: [
    {
      name: 'check_medicare_eligibility',
      description:
        'Estimate when someone becomes eligible for Medicare and what their premium may ' +
        'be, using the official Medicare.gov eligibility calculator. Needs date of birth ' +
        'and whether they worked 10+ years paying Medicare taxes. No login required. ' +
        'Reports what the calculator says.',
      inputSchema: {
        type: 'object',
        properties: {
          birthMonth: { type: 'number', description: 'Birth month (1–12)', minimum: 1, maximum: 12 },
          birthDay:   { type: 'number', description: 'Birth day (1–31)', minimum: 1, maximum: 31 },
          birthYear:  { type: 'number', description: 'Four-digit birth year', minimum: 1900, maximum: 2026 },
          workedTenYearsPayingMedicareTaxes: {
            type: 'boolean',
            description: 'Worked at least 10 years for which Medicare taxes were paid?',
          },
        },
        required: ['birthMonth', 'birthDay', 'birthYear', 'workedTenYearsPayingMedicareTaxes'],
      },

      async execute(
        params: {
          birthMonth: number;
          birthDay: number;
          birthYear: number;
          workedTenYearsPayingMedicareTaxes: boolean;
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        const { page, utils, notify } = context;
        try {
          notify.info('Loading the Medicare eligibility calculator…');
          await page.navigate(CALC_URL, {
            waitForSelector: '#btnEligibility',
            timeout: 30_000,
          });

          await page.click('#btnEligibility', { timeout: 15_000 });
          await page.waitForSelector('#eligibilityForm', { timeout: 15_000 });

          await page.fillField('#under65__month', String(params.birthMonth));
          await page.fillField('#under65__day', String(params.birthDay));
          await page.fillField('#under65__year', String(params.birthYear));
          await page.click(
            params.workedTenYearsPayingMedicareTaxes ? '#fica__choice--0' : '#fica__choice--1',
            { timeout: 10_000 },
          );

          await page.click('#btnEligibilitySubmit', { timeout: 15_000 });
          await utils.sleep(2_500); // SPA renders results in place

          const resultText =
            (await page.getText('main')) ?? (await page.getText('body')) ?? '';

          // Report what the SITE says — no local eligibility rules
          return {
            success: true,
            data: {
              siteReportedResults: resultText.replace(/\s+/g, ' ').trim().slice(0, 2_500),
              resultUrl: page.currentUrl(),
              source: 'Medicare.gov eligibility & premium calculator',
              note: 'An estimate from the official calculator — not an eligibility determination.',
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
