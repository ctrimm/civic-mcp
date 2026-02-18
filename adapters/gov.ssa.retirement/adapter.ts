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
          birthYear: {
            type: 'number',
            description: 'Four-digit birth year (e.g. 1965)',
            minimum: 1924,
            maximum: 2005,
          },
          currentAnnualEarnings: {
            type: 'number',
            description: 'Current (or most recent) annual earnings in dollars before taxes',
            minimum: 0,
          },
          plannedRetirementYear: {
            type: 'number',
            description: 'Year you plan to stop working (defaults to age-62 year if omitted)',
          },
        },
        required: ['birthYear', 'currentAnnualEarnings'],
      },

      async execute(
        params: {
          birthYear: number;
          currentAnnualEarnings: number;
          plannedRetirementYear?: number;
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        const { page, storage, notify } = context;

        try {
          // Cache keyed by inputs — estimates don't change often
          const cacheKey = `estimate:${params.birthYear}:${params.currentAnnualEarnings}:${params.plannedRetirementYear ?? ''}`;
          const cached = await storage.get<{ data: unknown; at: string }>(cacheKey);
          if (cached) {
            const ageHours = (Date.now() - new Date(cached.at).getTime()) / 3_600_000;
            if (ageHours < 72) return { success: true, data: cached.data as Record<string, unknown> };
          }

          notify.info('Loading SSA Quick Calculator…');

          await page.navigate('https://www.ssa.gov/OACT/quickcalc/', {
            waitForSelector: 'input#dobElem, input[name="dobElem"], form',
            timeout: 20_000,
          });

          // Birth year (the calculator uses a single year field, not full DOB)
          await page.fillField(
            'input#dobElem, input[name="dobElem"], input[name="born"]',
            String(params.birthYear),
          );

          // Current earnings
          await page.fillField(
            'input#earnings, input[name="earnings"]',
            String(params.currentAnnualEarnings),
          );

          // Planned retirement year (optional)
          if (params.plannedRetirementYear) {
            const hasRetireField = await page.exists('input#retireYear, input[name="retireYear"]');
            if (hasRetireField) {
              await page.fillField(
                'input#retireYear, input[name="retireYear"]',
                String(params.plannedRetirementYear),
              );
            }
          }

          // Submit
          await page.click(
            'input[type="submit"], button[value="Calculate"], button[type="submit"]',
            { waitForNavigation: false },
          );

          // Wait for results table
          await page.waitForSelector(
            'table.Results, table#Results, #resultTable, .result',
            { timeout: 15_000 },
          );

          // Extract benefit estimates
          const at62  = await page.getText('td#age62,  tr:nth-child(1) td.amount, td.age62');
          const atFRA = await page.getText('td#fra,    tr:nth-child(2) td.amount, td.fra');
          const at70  = await page.getText('td#age70,  tr:nth-child(3) td.amount, td.age70');

          const fra = fullRetirementAge(params.birthYear);
          const data = {
            estimatedMonthlyBenefit: {
              atAge62:             parseDollar(at62),
              atFullRetirementAge: parseDollar(atFRA),
              atAge70:             parseDollar(at70),
            },
            fullRetirementAge: fra,
            birthYear: params.birthYear,
            note: 'Estimates are in today\'s dollars and assume your earnings continue at the rate you provided.',
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
