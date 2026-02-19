/**
 * Social Security Retirement Benefits Adapter
 *
 * Target sites:
 *   estimate_retirement_benefit  → https://www.ssa.gov/OACT/quickcalc/
 *   start_retirement_application → https://secure.ssa.gov/iClaim/rib
 *
 * The quick-calculator tool runs fully autonomously (no login, no CAPTCHA).
 * The application tool fills personal info autonomously, then calls
 * waitForHuman() when reCAPTCHA appears — the SSA has required a human
 * verification step before submitting retirement claims since 2023.
 *
 * Selectors verified against the live site on 2026-02-18.
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a dollar string like "$1,234" → 1234 or return null */
function parseDollar(text: string | null): number | null {
  if (!text) return null;
  const n = parseFloat(text.replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
}

/** Rough full retirement age based on birth year (US law) */
function fullRetirementAge(birthYear: number): string {
  if (birthYear <= 1937) return '65';
  if (birthYear <= 1942) return `65 and ${(birthYear - 1937) * 2} months`;
  if (birthYear <= 1954) return '66';
  if (birthYear <= 1959) return `66 and ${(birthYear - 1954) * 2} months`;
  return '67';
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const adapter: AdapterModule = {
  id: 'gov.ssa.retirement',

  async init(context: SandboxContext): Promise<void> {
    const url = context.page.currentUrl();
    if (url.includes('ssa.gov')) {
      context.notify.info('Social Security adapter ready. Ask me about retirement benefits.');
    }
  },

  tools: [
    // ── estimate_retirement_benefit ─────────────────────────────────────────
    {
      name: 'estimate_retirement_benefit',
      description:
        'Estimate monthly Social Security retirement benefits using the SSA Quick Calculator. ' +
        'Returns estimated amounts at age 62, full retirement age, and age 70. ' +
        'No account or login required — runs fully autonomously.',

      inputSchema: {
        type: 'object',
        properties: {
          birthMonth: {
            type: 'number',
            description: 'Birth month as a number 1–12 (e.g. 3 for March). Defaults to 6.',
            minimum: 1,
            maximum: 12,
          },
          birthDay: {
            type: 'number',
            description: 'Birth day of the month 1–31. Defaults to 15.',
            minimum: 1,
            maximum: 31,
          },
          birthYear: {
            type: 'number',
            description: 'Four-digit birth year (e.g. 1965)',
            minimum: 1924,
            maximum: 2005,
          },
          currentAnnualEarnings: {
            type: 'number',
            description: 'Current (or most recent) annual earnings in dollars covered by Social Security, before taxes. Use 0 if retired.',
            minimum: 0,
          },
          lastYearWithEarnings: {
            type: 'number',
            description: 'If currentAnnualEarnings is 0 (retired), the last calendar year in which you had Social Security-covered earnings.',
          },
          lastYearEarningsAmount: {
            type: 'number',
            description: 'If currentAnnualEarnings is 0 (retired), the dollar amount of covered earnings in that last year.',
            minimum: 0,
          },
          plannedRetirementMonth: {
            type: 'number',
            description: 'Month (1–12) you plan to stop working. Must be provided alongside plannedRetirementYear.',
            minimum: 1,
            maximum: 12,
          },
          plannedRetirementYear: {
            type: 'number',
            description: 'Year you plan to stop working. If omitted, the calculator shows estimates at ages 62, FRA, and 70.',
          },
          dollarType: {
            type: 'string',
            enum: ['today', 'future'],
            description:
              'Whether to show benefit estimates in today\'s dollars (purchasing power) or ' +
              'future (inflated) dollars — the nominal amount you would actually receive. ' +
              'Defaults to "today".',
          },
        },
        required: ['birthYear', 'currentAnnualEarnings'],
      },

      async execute(
        params: {
          birthMonth?: number;
          birthDay?: number;
          birthYear: number;
          currentAnnualEarnings: number;
          lastYearWithEarnings?: number;
          lastYearEarningsAmount?: number;
          plannedRetirementMonth?: number;
          plannedRetirementYear?: number;
          dollarType?: 'today' | 'future';
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        const { page, storage, notify } = context;
        const dollarType = params.dollarType ?? 'today';
        const birthMonth = params.birthMonth ?? 6;
        const birthDay   = params.birthDay   ?? 15;

        try {
          // Cache keyed by all inputs — estimates don't change often
          const cacheKey = [
            'estimate',
            params.birthYear, birthMonth, birthDay,
            params.currentAnnualEarnings,
            params.lastYearWithEarnings ?? '',
            params.lastYearEarningsAmount ?? '',
            params.plannedRetirementMonth ?? '',
            params.plannedRetirementYear ?? '',
            dollarType,
          ].join(':');
          const cached = await storage.get<{ data: unknown; at: string }>(cacheKey);
          if (cached) {
            const ageHours = (Date.now() - new Date(cached.at).getTime()) / 3_600_000;
            if (ageHours < 72) return { success: true, data: cached.data as Record<string, unknown> };
          }

          notify.info('Loading SSA Quick Calculator…');

          await page.navigate('https://www.ssa.gov/OACT/quickcalc/', {
            waitForSelector: 'input#month, input[name="dobmon"]',
            timeout: 20_000,
          });

          // Date of birth — three separate text inputs
          await page.fillField('input#month, input[name="dobmon"]', String(birthMonth));
          await page.fillField('input#day,   input[name="dobday"]', String(birthDay));
          await page.fillField('input#year,  input[name="yob"]',    String(params.birthYear));

          // Current earnings
          await page.fillField(
            'input#earnings, input[name="earnings"]',
            String(params.currentAnnualEarnings),
          );

          // Zero-earnings (retired) — fill last year / last amount if provided
          if (params.currentAnnualEarnings === 0 && params.lastYearWithEarnings) {
            await page.fillField(
              'input#lastyear, input[name="lastYearEarn"]',
              String(params.lastYearWithEarnings),
            );
            if (params.lastYearEarningsAmount !== undefined) {
              await page.fillField(
                'input#lastearnings, input[name="lastEarn"]',
                String(params.lastYearEarningsAmount),
              );
            }
          }

          // Planned retirement date — requires both month and year
          if (params.plannedRetirementYear) {
            await page.fillField(
              'input#retiremonth, input[name="retiremonth"]',
              String(params.plannedRetirementMonth ?? birthMonth),
            );
            await page.fillField(
              'input#retireyear, input[name="retireyear"]',
              String(params.plannedRetirementYear),
            );
          }

          // Dollar type radio — today's dollars: value="1" (#constant, checked by default)
          //                     inflated dollars: value="0" (#nominal)
          if (dollarType === 'future') {
            await page.click(
              'input#nominal, input[name="dollars"][value="0"]',
              { waitForNavigation: false },
            );
          }
          // No click needed for 'today' — it is checked by default

          // Submit
          await page.click(
            'input[type="submit"][value="Submit request"]',
            { waitForNavigation: false },
          );

          // Wait for results table — SSA uses summary="benefits" on the estimate table
          await page.waitForSelector(
            "table[summary='benefits']",
            { timeout: 15_000 },
          );

          // Extract benefit estimates — IDs verified against live HTML 2026-02-19
          const at62  = await page.getText('td#est_early');
          const atFRA = await page.getText('td#est_fra');
          const at70  = await page.getText('td#est_late');

          const fra = fullRetirementAge(params.birthYear);
          const data = {
            estimatedMonthlyBenefit: {
              atAge62:             parseDollar(at62),
              atFullRetirementAge: parseDollar(atFRA),
              atAge70:             parseDollar(at70),
            },
            fullRetirementAge: fra,
            birthYear:  params.birthYear,
            birthMonth,
            birthDay,
            dollarType,
            note: dollarType === 'future'
              ? 'Estimates are in future (inflated) dollars — the nominal amount you would receive at retirement. ' +
                'Assumes earnings continue at the rate provided.'
              : 'Estimates are in today\'s dollars (constant purchasing power). ' +
                'Assumes earnings continue at the rate provided.',
            source: 'SSA Quick Calculator — https://www.ssa.gov/OACT/quickcalc/',
          };

          await storage.set(cacheKey, { data, at: new Date().toISOString() });
          return { success: true, data };

        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            code: 'UNKNOWN',
          };
        }
      },
    },

    // ── start_retirement_application ────────────────────────────────────────
    {
      name: 'start_retirement_application',
      description:
        'Begin a Social Security retirement benefits application on SSA.gov. ' +
        'The adapter fills personal information autonomously, then pauses for a ' +
        'human to solve the reCAPTCHA that SSA requires before submission. ' +
        'Returns a confirmation number once the application is submitted.',

      inputSchema: {
        type: 'object',
        properties: {
          dateOfBirth: {
            type: 'string',
            description: 'Date of birth in MM/DD/YYYY format (e.g. "01/15/1958")',
            pattern: '^\\d{2}/\\d{2}/\\d{4}$',
          },
          firstName: { type: 'string', description: 'Legal first name' },
          lastName:  { type: 'string', description: 'Legal last name' },
          phone: {
            type: 'string',
            description: 'Ten-digit US phone number (digits only)',
            pattern: '^\\d{10}$',
          },
          claimMonth: {
            type: 'string',
            description: 'Month you want benefits to begin (e.g. "January 2026"). Defaults to the earliest eligible month.',
          },
        },
        required: ['dateOfBirth', 'firstName', 'lastName', 'phone'],
      },

      async execute(
        params: {
          dateOfBirth: string;
          firstName: string;
          lastName: string;
          phone: string;
          claimMonth?: string;
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        const { page, notify, storage } = context;

        try {
          notify.info('Navigating to SSA retirement application…');

          // ── Step 1: Landing page — check eligibility ──────────────────────
          await page.navigate('https://secure.ssa.gov/iClaim/rib', {
            waitForSelector: 'input#birthDate, input[name="birthDate"], form, h1',
            timeout: 20_000,
          });

          // Enter date of birth to confirm age eligibility
          await page.fillField(
            'input#birthDate, input[name="birthDate"], input[id*="DateOfBirth"]',
            params.dateOfBirth,
          );

          await page.click(
            'button#continueBtn, input[type="submit"]#next, button[type="submit"]',
            { waitForNavigation: true, timeout: 15_000 },
          );

          // ── Step 2: Personal information form ─────────────────────────────
          await page.waitForSelector(
            'input#firstName, input[name="firstName"], form[id*="personal"]',
            { timeout: 15_000 },
          );

          notify.info('Filling personal information…');

          await page.fillField(
            'input#firstName, input[name="firstName"], input[id*="FirstName"]',
            params.firstName,
          );
          await page.fillField(
            'input#lastName, input[name="lastName"], input[id*="LastName"]',
            params.lastName,
          );
          await page.fillField(
            'input#phone, input[name="phone"], input[type="tel"]',
            params.phone,
          );

          if (params.claimMonth) {
            const hasClaimField = await page.exists(
              'input[name="claimMonth"], select[name="claimMonth"], input[id*="claimMonth"]',
            );
            if (hasClaimField) {
              await page.fillField(
                'input[name="claimMonth"], input[id*="claimMonth"]',
                params.claimMonth,
              );
            }
          }

          // ── Step 3: reCAPTCHA — human required ────────────────────────────
          //
          // SSA requires a reCAPTCHA verification before the final submit
          // button becomes active. The iframe appears after the personal-info
          // fields are filled. We cannot solve it programmatically, so we
          // suspend here and let the user solve it in the browser window.
          const hasCaptcha = await page.exists(
            'iframe[title*="reCAPTCHA"], iframe[src*="recaptcha"], .g-recaptcha',
          );

          if (hasCaptcha) {
            notify.warn('reCAPTCHA detected — pausing for human verification.');

            await page.waitForHuman({
              prompt:
                'SSA requires a reCAPTCHA before submitting your application.\n\n' +
                '1. Look at the browser window — a "I\'m not a robot" checkbox or image challenge should be visible.\n' +
                '2. Complete the reCAPTCHA challenge.\n' +
                '3. Click "Done — continue" here once the checkmark appears.',
              timeout: 10 * 60 * 1_000, // 10 minutes — image challenges can take a moment
            });

            notify.info('Verification complete — submitting application…');
          }

          // ── Step 4: Submit ─────────────────────────────────────────────────
          await page.click(
            'input[type="submit"]#submitBtn, button#iAgreeBtn, button[type="submit"].submit, button.submit-btn',
            { waitForNavigation: true, timeout: 20_000 },
          );

          // ── Step 5: Confirmation ───────────────────────────────────────────
          await page.waitForSelector(
            '#iClaim-confirm, .confirmation-number, [id*="confirmation"], h2.success',
            { timeout: 20_000 },
          );

          const confirmationNumber = await page.getText(
            '.confirmation-number, #confirmationNumber, [data-testid="confirmation-number"]',
          );
          const nextStepsText = await page.getText(
            '.next-steps, #nextSteps, .what-happens-next',
          );

          const result = {
            confirmationNumber: confirmationNumber ?? 'See page for confirmation number',
            nextSteps: nextStepsText ?? 'SSA will mail a letter within 5–7 business days.',
            applicationUrl: page.currentUrl(),
          };

          await storage.set('last_retirement_application', {
            ...result,
            submittedAt: new Date().toISOString(),
            applicant: `${params.firstName} ${params.lastName}`,
          });

          notify.info(`Application submitted! Confirmation: ${result.confirmationNumber}`);
          return { success: true, data: result };

        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            code: err instanceof Error && err.message.includes('not found') ? 'SITE_CHANGED' : 'UNKNOWN',
          };
        }
      },
    },
  ],
};

export default adapter;
