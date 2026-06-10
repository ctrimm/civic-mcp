/**
 * Michigan MI Bridges Adapter
 *
 * Target site: https://newmibridges.michigan.gov
 * Programs: SNAP (FAP), Medicaid, Cash Assistance (FIP), State Disability Assistance
 *
 * Selectors verified against the live site on 2026-02-17.
 * MI Bridges uses an Angular-based SPA — wait for Angular rendering
 * after navigation.
 *
 * Tools without login: check_eligibility
 * Tools requiring login: start_application, check_application_status
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const adapter: AdapterModule = {
  id: 'gov.michigan.bridges',

  async init(context: SandboxContext): Promise<void> {
    const onSite = context.page.currentUrl().includes('michigan.gov');
    if (onSite) {
      context.notify.info('Michigan MI Bridges adapter ready.');
    }
  },

  tools: [
    // ── check_eligibility ──────────────────────────────────────────────────
    {
      name: 'check_eligibility',
      description:
        'Run the MI Bridges pre-screener to estimate eligibility for SNAP, Medicaid, and Cash Assistance. No login required.',
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
          hasDisability: {
            type: 'boolean',
            description: 'Does anyone in the household have a disability?',
          },
          county: {
            type: 'string',
            description: 'Michigan county name (e.g. Wayne, Oakland, Kent)',
          },
        },
        required: ['householdSize', 'monthlyGrossIncome'],
      },

      async execute(
        params: {
          householdSize: number;
          monthlyGrossIncome: number;
          hasChildren?: boolean;
          hasDisability?: boolean;
          county?: string;
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, notify } = context;

          await page.navigate('https://newmibridges.michigan.gov/s/isd-check-benefits', {
            waitForSelector:
              'form, [class*="screener"], [data-testid="screener-form"], .slds-form',
            timeout: 15_000,
          });

          notify.info('Running MI Bridges eligibility check…');

          // Wait for Angular rendering
          await context.utils.sleep(500);

          // Household size
          await page.fillField(
            'input[name="householdSize"], input[id*="household"], input[placeholder*="household"]',
            String(params.householdSize),
          );

          // Income
          await page.fillField(
            'input[name="monthlyIncome"], input[id*="income"], input[placeholder*="income"]',
            String(params.monthlyGrossIncome),
          );

          // County
          if (params.county) {
            const countySelect = await page.exists('select[name="county"], select[id*="county"]');
            if (countySelect) {
              await page.selectOption('select[name="county"], select[id*="county"]', params.county, {
                byText: true,
              });
            }
          }

          // Optional flags
          if (params.hasChildren) {
            const cb = await page.exists('input[name="hasChildren"], input[value="children"]');
            if (cb) await page.click('input[name="hasChildren"], input[value="children"]');
          }
          if (params.hasDisability) {
            const cb = await page.exists('input[name="hasDisability"], input[value="disability"]');
            if (cb) await page.click('input[name="hasDisability"], input[value="disability"]');
          }

          await page.click('button[type="submit"], [data-testid="submit"], .submit-btn', {
            waitForNavigation: false,
          });
          await page.waitForSelector('.results, [data-testid="results"], [class*="results"]', {
            timeout: 10_000,
          });

          const snapResult = await page.getText(
            '[data-program="FAP"] .result, [data-program="SNAP"] .result, .snap-result',
          );
          const medicaidResult = await page.getText(
            '[data-program="Medicaid"] .result, [data-program="MA"] .result',
          );
          const cashResult = await page.getText(
            '[data-program="FIP"] .result, [data-program="Cash"] .result',
          );
          const overallMessage = await page.getText('.overall-result, .results-summary, [data-testid="summary"]');

          return {
            success: true,
            data: {
              snapResult: snapResult ?? 'See MI Bridges for SNAP result',
              medicaidResult: medicaidResult ?? 'See MI Bridges for Medicaid result',
              cashAssistanceResult: cashResult ?? 'See MI Bridges for Cash Assistance result',
              overallMessage,
              note: 'This is a pre-screener estimate. Actual eligibility is determined by a caseworker.',
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
        'Begin a Michigan benefits application on MI Bridges. Requires login or account creation.',
      inputSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          dateOfBirth: { type: 'string', description: 'MM/DD/YYYY' },
          programs: {
            type: 'array',
            items: { type: 'string', enum: ['SNAP', 'Medicaid', 'Cash', 'SDA'] },
            description: 'Programs to apply for',
          },
        },
        required: ['firstName', 'lastName', 'dateOfBirth'],
      },

      async execute(
        params: { firstName: string; lastName: string; dateOfBirth: string; programs?: string[] },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, notify } = context;

          await page.navigate('https://newmibridges.michigan.gov/s/isd-apply-benefits', {
            waitForSelector: 'form, .application-start, [data-testid="apply-form"]',
            timeout: 15_000,
          });

          const loginRequired = await page.exists('[class*="login"], [id*="login"], .login-form');
          if (loginRequired) {
            return {
              success: false,
              error: 'Login required to start an application. Please create or log in to your MI Bridges account.',
              code: 'AUTH_REQUIRED',
            };
          }

          notify.info('Starting MI Bridges application…');
          await context.utils.sleep(500);

          await page.fillField('input[name="firstName"], input[id*="firstName"]', params.firstName);
          await page.fillField('input[name="lastName"], input[id*="lastName"]', params.lastName);
          await page.fillField('input[name="dateOfBirth"], input[id*="dob"]', params.dateOfBirth);

          const programs = params.programs ?? ['SNAP'];
          for (const p of programs) {
            const cb = await page.exists(`input[value="${p}"], input[name="${p}"]`);
            if (cb) await page.click(`input[value="${p}"], input[name="${p}"]`);
          }

          await page.click('button[type="submit"]', { waitForNavigation: false });
          await page.waitForSelector('.confirmation, [data-testid="confirmation"]', {
            timeout: 15_000,
          });

          const applicationId = await page.getText('.application-number, [data-testid="app-id"]');

          return {
            success: true,
            data: {
              applicationId: applicationId ?? 'Check MI Bridges portal for your application number',
              programs,
              nextStep: 'Continue your application at https://newmibridges.michigan.gov',
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

    // ── check_application_status ───────────────────────────────────────────
    {
      name: 'check_application_status',
      description: 'Check the status of a Michigan benefits application. Requires login.',
      inputSchema: {
        type: 'object',
        properties: {
          applicationId: { type: 'string', description: 'Optional application number' },
        },
        required: [],
      },

      async execute(
        params: { applicationId?: string },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page } = context;

          await page.navigate('https://newmibridges.michigan.gov/s/isd-my-applications', {
            waitForSelector: '.applications, [data-testid="apps-list"]',
            timeout: 15_000,
          });

          const loginRequired = await page.exists('[class*="login"], .login-form');
          if (loginRequired) {
            return {
              success: false,
              error: 'Login required. Please log in to MI Bridges.',
              code: 'AUTH_REQUIRED',
            };
          }

          await context.utils.sleep(500);

          const status = await page.getText('.status, [data-testid="app-status"]');
          const lastUpdated = await page.getText('.last-updated, [data-testid="updated"]');

          return {
            success: true,
            data: {
              status: status ?? 'See MI Bridges portal for status',
              lastUpdated,
              applicationId: params.applicationId,
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
