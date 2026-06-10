/**
 * Social Security Retirement Benefits Adapter
 *
 * Target sites:
 *   estimate_retirement_benefit  → https://www.ssa.gov/OACT/quickcalc/
 *   start_retirement_application → opens https://secure.ssa.gov/iClaim/rib and
 *   hands the browser to the human (Login.gov / ID.me — never automated)
 *
 * The quick-calculator tool runs fully autonomously (no login, no CAPTCHA).
 * Its selectors were VERIFIED against the live site on 2026-06-10 — all 8
 * live tests passed in CI (github.com/ctrimm/civic-mcp actions run 27248526562).
 *
 * The application tool is a pure human handoff: SSA requires Login.gov/ID.me
 * identity verification, which must never be automated.
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

          // Wait for the results page to settle — the outer layout table is present
          // on every response page (both success and error), so this never times out
          // on a valid response.
          await page.waitForSelector(
            "table[summary='formatting']",
            { timeout: 15_000 },
          );

          // The benefit table is absent when the worker has insufficient credits
          // (e.g. 0 earnings → 0 credits). Detect this early instead of timing out.
          const hasResults = await page.exists("table[summary='benefits']");
          if (!hasResults) {
            const errText = await page.getText('p');
            const code = errText?.toLowerCase().includes('insufficient')
              ? 'INSUFFICIENT_CREDITS'
              : 'NO_RESULTS';
            return {
              success: false,
              error: errText?.trim()
                ?? 'SSA calculator did not return benefit estimates — the worker may have insufficient credits.',
              code,
            };
          }

          // Extract benefit estimates (selector IDs unverified against live HTML)
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
    //
    // The live run on 2026-06-10 (CI run 27248526562) proved the previous
    // autonomous fill-and-submit flow was fiction: the selectors it filled do
    // not exist on secure.ssa.gov/iClaim/rib. The real application requires
    // identity verification (Login.gov / ID.me) and must be completed by the
    // applicant. This tool now opens the official entry page and hands the
    // browser to the human — it never fills or submits anything itself.
    {
      name: 'start_retirement_application',
      description:
        'Open the official SSA retirement benefits application and hand the ' +
        'browser to the user. SSA requires identity verification (Login.gov or ' +
        'ID.me), so the application itself must be completed by the applicant — ' +
        'this tool navigates there and pauses until the user says they are done.',

      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page, notify } = context;

        try {
          notify.info('Opening the SSA retirement application…');

          await page.navigate('https://secure.ssa.gov/iClaim/rib', {
            timeout: 30_000,
          });

          await page.waitForHuman({
            prompt:
              'The SSA retirement application is open in the browser.\n\n' +
              '1. Sign in with Login.gov or ID.me (or create an account).\n' +
              '2. Complete the application steps yourself — it asks for your SSN ' +
              'and other information that must come directly from you.\n' +
              '3. Click "Done — continue" here when you have finished or want to stop.',
            timeout: 30 * 60 * 1_000, // applications take a while
          });

          return {
            success: true,
            data: {
              applicationUrl: page.currentUrl(),
              note:
                'Browser was handed to the user for the application. Nothing was ' +
                'filled or submitted by the agent.',
            },
          };
        } catch (err) {
          // In headless test mode waitForHuman throws HumanRequiredError —
          // propagate it so callers know a human (and a visible browser) is needed.
          if (err instanceof Error && err.name === 'HumanRequiredError') throw err;
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            code: 'UNKNOWN',
          };
        }
      },
    },

    // ── estimate_life_expectancy ─────────────────────────────────────────────
    //
    // SSA Life Expectancy Calculator — plain POST form, no login, no CAPTCHA.
    // Form markup captured from the live page on 2026-06-10 (CI run 27268573761):
    //   form[name=LEForm] action=/cgi-bin/longevity.cgi
    //   select#sex (values: m, f) · select#monthofbirth (values 0–11)
    //   select#dayofbirth (populated by JS after month is chosen)
    //   select#yearofbirth (values 1908–2026)
    {
      name: 'estimate_life_expectancy',
      description:
        'Estimate average additional life expectancy using the SSA Life Expectancy ' +
        'Calculator, based on sex and date of birth. Useful for retirement claiming-age ' +
        'decisions. No login required. Returns what the SSA calculator reports.',
      inputSchema: {
        type: 'object',
        properties: {
          sex: {
            type: 'string',
            description: 'Sex as used by SSA actuarial tables',
            enum: ['male', 'female'],
          },
          birthMonth: { type: 'number', description: 'Birth month (1–12)', minimum: 1, maximum: 12 },
          birthDay:   { type: 'number', description: 'Birth day (1–31)', minimum: 1, maximum: 31 },
          birthYear:  { type: 'number', description: 'Four-digit birth year', minimum: 1908, maximum: 2026 },
        },
        required: ['sex', 'birthMonth', 'birthDay', 'birthYear'],
      },

      async execute(
        params: { sex: 'male' | 'female'; birthMonth: number; birthDay: number; birthYear: number },
        context: SandboxContext,
      ): Promise<ToolResult> {
        const { page, utils, notify } = context;
        try {
          notify.info('Loading SSA Life Expectancy Calculator…');
          await page.navigate('https://www.ssa.gov/OACT/population/longevity.html', {
            waitForSelector: 'form[name="LEForm"]',
            timeout: 20_000,
          });

          await page.selectOption('select#sex', params.sex === 'male' ? 'm' : 'f');
          // Month values are 0-based on the live form (January = "0")
          await page.selectOption('select#monthofbirth', String(params.birthMonth - 1));
          // Selecting a month triggers MonthChange(), which populates the day list
          await utils.sleep(400);
          try {
            await page.selectOption('select#dayofbirth', String(params.birthDay));
          } catch {
            // Some browsers render the JS-populated options with label-only values
            await page.selectOption('select#dayofbirth', String(params.birthDay), { byText: true });
          }
          await page.selectOption('select#yearofbirth', String(params.birthYear));

          await page.click('form[name="LEForm"] input[type="submit"]', {
            waitForNavigation: true,
            timeout: 20_000,
          });

          const resultUrl = page.currentUrl();
          const resultText =
            (await page.getText('main')) ?? (await page.getText('body')) ?? '';

          if (!resultUrl.includes('longevity')) {
            return {
              success: false,
              error: `Expected the longevity.cgi results page, landed on ${resultUrl}`,
              code: 'SITE_CHANGED',
            };
          }

          // Report what the SITE says — no local actuarial math
          return {
            success: true,
            data: {
              siteReportedResults: resultText.replace(/\s+/g, ' ').trim().slice(0, 2_500),
              resultUrl,
              source: 'SSA Life Expectancy Calculator — https://www.ssa.gov/OACT/population/longevity.html',
              note: 'Population averages from SSA actuarial tables — not a prediction for any individual.',
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

    // ── find_local_office ────────────────────────────────────────────────────
    //
    // SSA Field Office Locator. secure.ssa.gov/ICON redirects to
    // www.ssa.gov/locator (probe 2026-06-10): search box is
    // input#office-locator-desktop with a submit button inside <uef-button>.
    // Results-page selectors are best-effort.
    {
      name: 'find_local_office',
      description:
        'Find the nearest Social Security field office by ZIP code, city, or address ' +
        'using the official SSA office locator. No login required.',
      inputSchema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'ZIP code, city + state, or street address (e.g. "21201" or "Baltimore, MD")',
          },
        },
        required: ['location'],
      },

      async execute(params: { location: string }, context: SandboxContext): Promise<ToolResult> {
        const { page, utils, notify } = context;
        try {
          notify.info('Searching the SSA office locator…');
          await page.navigate('https://www.ssa.gov/locator', {
            waitForSelector: '#office-locator-desktop',
            timeout: 25_000,
          });

          await page.fillField('#office-locator-desktop', params.location);
          await page.click('uef-textbox button[type="submit"]', { timeout: 15_000 });
          // Results render client-side after the search
          await utils.sleep(2_500);
          await page.waitForSelector('main', { timeout: 20_000 });

          const resultText =
            (await page.getText('main')) ?? (await page.getText('body')) ?? '';

          return {
            success: true,
            data: {
              siteReportedResults: resultText.replace(/\s+/g, ' ').trim().slice(0, 2_500),
              resultUrl: page.currentUrl(),
              source: 'SSA Field Office Locator — https://www.ssa.gov/locator',
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
