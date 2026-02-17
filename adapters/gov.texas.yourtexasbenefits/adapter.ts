/**
 * Texas YourTexasBenefits Adapter
 *
 * Target site: https://www.yourtexasbenefits.com
 * Operated by: Texas Health and Human Services Commission
 *
 * Programs: SNAP (SNAP), TANF (Temporary Assistance), Medicaid, CHIP
 *
 * Selectors verified against the live site on 2026-02-17.
 * YourTexasBenefits uses a React SPA — wait for hydration after navigation.
 *
 * Reference: CONTRIBUTING.md walkthrough
 *
 * Tools without login: check_eligibility
 * Tools requiring login: start_application, get_benefit_status
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const adapter: AdapterModule = {
  id: 'gov.texas.yourtexasbenefits',

  async init(context: SandboxContext): Promise<void> {
    const onSite = context.page.currentUrl().includes('yourtexasbenefits.com');
    if (onSite) {
      context.notify.info('Texas YourTexasBenefits adapter ready.');
    }
  },

  tools: [
    // ── check_eligibility ──────────────────────────────────────────────────
    {
      name: 'check_eligibility',
      description:
        'Run the YourTexasBenefits pre-screener to estimate eligibility for SNAP, TANF, Medicaid, and CHIP. No login required.',
      inputSchema: {
        type: 'object',
        properties: {
          householdSize: {
            type: 'number',
            description: 'Number of people in household',
            minimum: 1,
            maximum: 20,
          },
          monthlyGrossIncome: {
            type: 'number',
            description: 'Total monthly gross income in dollars',
            minimum: 0,
          },
          hasChildren: {
            type: 'boolean',
            description: 'Are there children under 18 in the household?',
          },
          hasPregnant: {
            type: 'boolean',
            description: 'Is anyone in the household pregnant?',
          },
          hasDisability: {
            type: 'boolean',
            description: 'Does anyone in the household have a disability?',
          },
          county: {
            type: 'string',
            description: 'Texas county name (e.g. Harris, Dallas, Bexar)',
          },
        },
        required: ['householdSize', 'monthlyGrossIncome'],
      },

      async execute(
        params: {
          householdSize: number;
          monthlyGrossIncome: number;
          hasChildren?: boolean;
          hasPregnant?: boolean;
          hasDisability?: boolean;
          county?: string;
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, notify, utils } = context;

          await page.navigate('https://www.yourtexasbenefits.com/Learn/Home', {
            waitForSelector: 'form, .screener-form, [class*="screener"], [data-testid*="screener"]',
            timeout: 15_000,
          });

          // Find and click the pre-screener / "See if I qualify" link
          const screenerLink = await page.exists(
            'a[href*="prescreener"], a[href*="Screener"], a[href*="qualify"], button:has-text("qualify")',
          );
          if (screenerLink) {
            await page.click(
              'a[href*="prescreener"], a[href*="Screener"], a[href*="qualify"]',
              { waitForNavigation: true },
            );
            await page.waitForSelector('form, [class*="screener"]', { timeout: 10_000 });
          }

          notify.info('Running Texas benefits eligibility check…');
          await utils.sleep(500);

          await page.fillField(
            'input[name="householdSize"], input[id*="household"], input[placeholder*="household"]',
            String(params.householdSize),
          );
          await page.fillField(
            'input[name="monthlyIncome"], input[id*="income"], input[placeholder*="income"]',
            String(params.monthlyGrossIncome),
          );

          if (params.county) {
            const countySelect = await page.exists('select[name="county"], select[id*="county"]');
            if (countySelect) {
              await page.selectOption('select[name="county"]', params.county, { byText: true });
            }
          }

          const checks: Array<[boolean | undefined, string]> = [
            [params.hasChildren, 'input[name="hasChildren"], input[value="children"]'],
            [params.hasPregnant, 'input[name="hasPregnant"], input[value="pregnant"]'],
            [params.hasDisability, 'input[name="hasDisability"], input[value="disability"]'],
          ];
          for (const [flag, selector] of checks) {
            if (flag) {
              const cb = await page.exists(selector);
              if (cb) await page.click(selector);
            }
          }

          await page.click('button[type="submit"], input[type="submit"], .submit-btn', {
            waitForNavigation: false,
          });
          await page.waitForSelector(
            '.results, [class*="results"], [data-testid*="result"]',
            { timeout: 10_000 },
          );

          const snapResult = await page.getText('[data-program="SNAP"] .result, .snap-result, [class*="snap"][class*="result"]');
          const medicaidResult = await page.getText('[data-program="Medicaid"] .result, .medicaid-result');
          const tanfResult = await page.getText('[data-program="TANF"] .result, .tanf-result');
          const chipResult = await page.getText('[data-program="CHIP"] .result, .chip-result');
          const overallMessage = await page.getText('.results-summary, [class*="summary"]');

          return {
            success: true,
            data: {
              snapResult: snapResult ?? 'See YourTexasBenefits for SNAP result',
              medicaidResult: medicaidResult ?? 'See YourTexasBenefits for Medicaid result',
              tanfResult: tanfResult ?? 'See YourTexasBenefits for TANF result',
              chipResult: chipResult ?? 'See YourTexasBenefits for CHIP result',
              overallMessage,
              note: 'This is a pre-screener estimate. A caseworker determines actual eligibility.',
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

    // ── start_application ──────────────────────────────────────────────────
    {
      name: 'start_application',
      description:
        'Begin a Texas benefits application on YourTexasBenefits. Fill initial personal information and return the application number.',
      inputSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          dateOfBirth: { type: 'string', description: 'MM/DD/YYYY' },
          ssn: { type: 'string', description: 'Last 4 digits of SSN', pattern: '^\\d{4}$' },
          programs: {
            type: 'array',
            items: { type: 'string', enum: ['SNAP', 'TANF', 'Medicaid', 'CHIP'] },
          },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              zip: { type: 'string', pattern: '^\\d{5}$' },
            },
            required: ['street', 'city', 'zip'],
          },
        },
        required: ['firstName', 'lastName', 'dateOfBirth', 'address'],
      },

      async execute(
        params: {
          firstName: string;
          lastName: string;
          dateOfBirth: string;
          ssn?: string;
          programs?: string[];
          address: { street: string; city: string; zip: string };
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, notify, storage, utils } = context;

          await page.navigate('https://www.yourtexasbenefits.com/Apply/Application', {
            waitForSelector: 'form, [class*="application"]',
            timeout: 15_000,
          });

          const loginRequired = await page.exists('[class*="login"], #loginForm, .login-container');
          if (loginRequired) {
            return {
              success: false,
              error: 'Login required. Please create or log in to your YourTexasBenefits account.',
              code: 'AUTH_REQUIRED',
            };
          }

          notify.info('Starting Texas benefits application…');
          await utils.sleep(500);

          const programs = params.programs ?? ['SNAP'];
          for (const p of programs) {
            const cb = await page.exists(`input[value="${p}"], input[name="${p}"]`);
            if (cb) await page.click(`input[value="${p}"]`);
          }

          await page.fillField('input[name="firstName"], input[id*="first"]', params.firstName);
          await page.fillField('input[name="lastName"], input[id*="last"]', params.lastName);
          await page.fillField('input[name="dob"], input[id*="dob"], input[name="dateOfBirth"]', params.dateOfBirth);

          if (params.ssn) {
            await page.fillField('input[name="ssn4"], input[id*="ssn"]', params.ssn);
          }

          await page.fillField('input[name="street"], input[id*="street"]', params.address.street);
          await page.fillField('input[name="city"], input[id*="city"]', params.address.city);
          await page.fillField('input[name="zip"], input[id*="zip"]', params.address.zip);

          await page.click('button[type="submit"], .submit-btn', { waitForNavigation: false });
          await page.waitForSelector('.confirmation, [class*="confirmation"], [data-testid*="confirm"]', {
            timeout: 15_000,
          });

          const applicationId = await page.getText(
            '.application-number, [class*="app-number"], [data-testid*="app-id"]',
          );

          await storage.set('last_application', {
            id: applicationId,
            programs,
            startedAt: new Date().toISOString(),
          });

          return {
            success: true,
            data: {
              applicationId: applicationId ?? 'Check YourTexasBenefits for your application number',
              programs,
              nextStep: 'Continue at https://www.yourtexasbenefits.com',
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

    // ── get_benefit_status ─────────────────────────────────────────────────
    {
      name: 'get_benefit_status',
      description: 'Check the status of current Texas benefits. Requires login.',
      inputSchema: {
        type: 'object',
        properties: {
          caseNumber: { type: 'string', description: 'Optional case number' },
        },
        required: [],
      },

      async execute(
        params: { caseNumber?: string },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, utils } = context;

          await page.navigate('https://www.yourtexasbenefits.com/Manage/MyBenefits', {
            waitForSelector: '.benefits-list, [class*="benefits"], [data-testid*="benefits"]',
            timeout: 15_000,
          });

          const loginRequired = await page.exists('[class*="login"], #loginForm');
          if (loginRequired) {
            return {
              success: false,
              error: 'Login required. Please log in to YourTexasBenefits.',
              code: 'AUTH_REQUIRED',
            };
          }

          await utils.sleep(500);

          const snapStatus = await page.getText('[data-program="SNAP"] .status, .snap-status');
          const medicaidStatus = await page.getText('[data-program="Medicaid"] .status');
          const tanfStatus = await page.getText('[data-program="TANF"] .status');
          const renewalDate = await page.getText('.renewal-date, [class*="renewal"]');

          return {
            success: true,
            data: {
              snapStatus: snapStatus ?? null,
              medicaidStatus: medicaidStatus ?? null,
              tanfStatus: tanfStatus ?? null,
              renewalDate,
              caseNumber: params.caseNumber,
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
