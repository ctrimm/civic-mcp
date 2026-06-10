/**
 * California BenefitsCal Adapter
 *
 * Target site: https://benefitscal.com — California's OFFICIAL portal for
 * CalFresh (SNAP), CalWORKs, Medi-Cal, and General Assistance.
 *
 * Selectors are best-effort and UNVERIFIED against the live site.
 * Verify and update before relying on this adapter.
 *
 * Tools:
 *   - check_eligibility:  "Am I eligible?" pre-screener (no login required)
 *   - get_case_status:    case dashboard (requires login — pauses with
 *                          waitForHuman so the user can sign in; the session
 *                          then persists in the identity's browser profile)
 *   - start_application:  begin a new application; prefills contact fields
 *                          from the identity's applicant profile when present
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const BASE = 'https://benefitscal.com';

/** First selector in the list that exists on the page, or null. */
async function firstExisting(
  context: SandboxContext,
  selectors: string[],
): Promise<string | null> {
  for (const sel of selectors) {
    if (await context.page.exists(sel)) return sel;
  }
  return null;
}

const adapter: AdapterModule = {
  id: 'gov.california.benefitscal',

  tools: [
    // ── check_eligibility ────────────────────────────────────────────────
    {
      name: 'check_eligibility',
      description:
        'Run the BenefitsCal "Am I eligible?" pre-screener for California benefits ' +
        '(CalFresh, CalWORKs, Medi-Cal). No login required. Returns the programs the ' +
        'household may qualify for, as reported by the site.',
      inputSchema: {
        type: 'object',
        properties: {
          zipCode: {
            type: 'string',
            description: 'California ZIP code',
            pattern: '^9\\d{4}$',
          },
          householdSize: {
            type: 'number',
            description: 'Number of people in the household',
            minimum: 1,
            maximum: 20,
          },
          monthlyGrossIncome: {
            type: 'number',
            description: 'Total monthly gross household income in dollars, before taxes',
            minimum: 0,
          },
        },
        required: ['zipCode', 'householdSize', 'monthlyGrossIncome'],
      },

      async execute(
        params: { zipCode: string; householdSize: number; monthlyGrossIncome: number },
        context: SandboxContext,
      ): Promise<ToolResult> {
        const { page } = context;
        try {
          await page.navigate(`${BASE}/help-me-find/am-i-eligible`, {
            waitForSelector: 'form, main, [role="main"]',
            timeout: 20_000,
          });

          const zipSel = await firstExisting(context, [
            'input[name="zipCode"]',
            'input[name="zip"]',
            'input#zipCode',
            'input[placeholder*="ZIP" i]',
          ]);
          if (!zipSel) {
            return {
              success: false,
              error:
                'Could not find the ZIP code field — BenefitsCal may have changed its ' +
                'pre-screener layout. This adapter\'s selectors are unverified; please ' +
                'report this at https://github.com/ctrimm/civic-mcp/issues',
              code: 'SELECTOR_NOT_FOUND',
            };
          }
          await page.fillField(zipSel, params.zipCode);

          const sizeSel = await firstExisting(context, [
            'input[name="householdSize"]',
            'select[name="householdSize"]',
            'input#householdSize',
            'input[aria-label*="household" i]',
          ]);
          if (sizeSel) await page.fillField(sizeSel, String(params.householdSize));

          const incomeSel = await firstExisting(context, [
            'input[name="monthlyIncome"]',
            'input[name="income"]',
            'input#monthlyIncome',
            'input[aria-label*="income" i]',
          ]);
          if (incomeSel) await page.fillField(incomeSel, String(params.monthlyGrossIncome));

          await page.click('button[type="submit"], button.continue, [data-testid="submit"]', {
            waitForNavigation: true,
          });
          await page.waitForSelector(
            '.results, .eligibility-results, [data-testid="results"], main',
            { timeout: 20_000 },
          );

          const resultsText = await page.getText(
            '.results, .eligibility-results, [data-testid="results"], main',
          );

          // Report what the SITE says — never compute eligibility locally
          return {
            success: true,
            data: {
              siteReportedResults: resultsText?.slice(0, 2_000) ?? null,
              screenerUrl: page.currentUrl(),
              note: 'Pre-screening only — not an eligibility determination. Apply to get a real decision.',
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

    // ── get_case_status ──────────────────────────────────────────────────
    {
      name: 'get_case_status',
      description:
        'Check the status of existing BenefitsCal cases (CalFresh, CalWORKs, Medi-Cal). ' +
        'Requires a BenefitsCal account: on first use the browser pauses so the user can ' +
        'log in; the session is then remembered in the active identity.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page } = context;
        try {
          await page.navigate(`${BASE}/dashboard`, { timeout: 20_000 });

          // If we got bounced to login, ask the human to sign in once.
          const loginSel = await firstExisting(context, [
            'input[type="password"]',
            'form[action*="login" i]',
            '#signin, #login',
          ]);
          if (loginSel) {
            await page.waitForHuman({
              prompt:
                'BenefitsCal needs you to log in. Sign in (including any code sent to ' +
                'your phone/email), then continue. Your session will be remembered.',
              timeout: 10 * 60 * 1_000,
            });
            await page.navigate(`${BASE}/dashboard`, { timeout: 20_000 });
          }

          await page.waitForSelector(
            '.case-summary, .cases, [data-testid="cases"], main',
            { timeout: 20_000 },
          );
          const casesText = await page.getText(
            '.case-summary, .cases, [data-testid="cases"], main',
          );

          return {
            success: true,
            data: {
              caseSummary: casesText?.slice(0, 2_000) ?? null,
              dashboardUrl: page.currentUrl(),
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

    // ── start_application ────────────────────────────────────────────────
    {
      name: 'start_application',
      description:
        'Begin a new benefits application on BenefitsCal (CalFresh, CalWORKs, and/or ' +
        'Medi-Cal). Prefills contact information from the saved applicant profile when ' +
        'one exists. Pauses for human review before anything is submitted.',
      inputSchema: {
        type: 'object',
        properties: {
          programs: {
            type: 'array',
            description: 'Programs to apply for',
            items: { type: 'string', enum: ['CalFresh', 'CalWORKs', 'Medi-Cal', 'General Assistance'] },
          },
        },
      },

      async execute(
        _params: { programs?: string[] },
        context: SandboxContext,
      ): Promise<ToolResult> {
        const { page, identity, notify } = context;
        try {
          await page.navigate(`${BASE}/apply`, {
            waitForSelector: 'form, main, [role="main"]',
            timeout: 20_000,
          });

          // Prefill from the identity's applicant profile, if the host provides one
          const profile = identity ? await identity.getProfile() : null;
          const prefilled: string[] = [];
          if (profile) {
            const fieldMap: [string[], string | undefined][] = [
              [['input[name="firstName"]', 'input#firstName'], profile.firstName],
              [['input[name="lastName"]', 'input#lastName'], profile.lastName],
              [['input[name="email"]', 'input[type="email"]'], profile.email],
              [['input[name="phone"]', 'input[type="tel"]'], profile.phone],
              [['input[name="zip"]', 'input[name="zipCode"]'], profile.address?.zip],
            ];
            for (const [selectors, value] of fieldMap) {
              if (!value) continue;
              const sel = await firstExisting(context, selectors);
              if (sel) {
                await page.fillField(sel, value);
                prefilled.push(sel);
              }
            }
            if (prefilled.length > 0) {
              notify.info(`Prefilled ${prefilled.length} field(s) from identity "${identity!.name()}".`);
            }
          }

          // Never submit autonomously — a human reviews the page first.
          await page.waitForHuman({
            prompt:
              'A new BenefitsCal application has been started and prefilled. Review ' +
              'everything on the page, complete any missing fields, and click through ' +
              'the steps yourself — then continue here.',
            timeout: 30 * 60 * 1_000,
          });

          return {
            success: true,
            data: {
              prefilledFields: prefilled.length,
              currentUrl: page.currentUrl(),
              note: 'Application flow handed to the human for review and submission.',
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
