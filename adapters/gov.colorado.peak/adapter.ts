/**
 * Colorado PEAK Benefits Adapter
 *
 * Target site: https://peak.my.site.com (Salesforce Experience Cloud / LWC)
 *
 * SELECTOR NOTES — Salesforce LWC sites use Shadow DOM and dynamic class names.
 * All selectors here were mapped against the live site on 2026-02-17.
 * Monitor for breakage when the state deploys PEAK updates.
 *
 * Tools available WITHOUT login (screener):
 *   - check_program_eligibility
 *   - get_peak_page_info
 *
 * Tools that require authentication:
 *   - start_snap_application
 *   - check_application_status
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

// ---------------------------------------------------------------------------
// SNAP Federal Poverty Level thresholds (2024)
// 130% FPL = gross income limit for SNAP
// ---------------------------------------------------------------------------
const SNAP_GROSS_LIMITS_MONTHLY: Record<number, number> = {
  1: 1580, 2: 2137, 3: 2694, 4: 3250,
  5: 3807, 6: 4364, 7: 4921, 8: 5478,
};
function snapGrossLimit(householdSize: number): number {
  if (householdSize <= 8) return SNAP_GROSS_LIMITS_MONTHLY[householdSize] ?? 5478;
  return 5478 + (householdSize - 8) * 557;
}

// ---------------------------------------------------------------------------
// Adapter definition
// ---------------------------------------------------------------------------

const adapter: AdapterModule = {
  id: 'gov.colorado.peak',

  async init(context: SandboxContext): Promise<void> {
    // Store current URL to detect if we're already on PEAK
    const currentUrl = context.page.currentUrl();
    if (currentUrl.includes('peak.my.site.com')) {
      const prefs = await context.storage.get<{ initialized: boolean }>('prefs');
      if (!prefs?.initialized) {
        context.notify.info('Colorado PEAK adapter ready. Ask me about SNAP, Medicaid, or Colorado Works eligibility.');
        await context.storage.set('prefs', { initialized: true });
      }
    }
  },

  tools: [
    // ── check_program_eligibility ──────────────────────────────────────────
    {
      name: 'check_program_eligibility',
      description:
        'Run the Colorado PEAK pre-screener to estimate eligibility for SNAP, Medicaid, Colorado Works, and CHP+. Does not require login.',
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
            description: 'Total monthly gross income in dollars (before taxes)',
            minimum: 0,
          },
          hasElderly: {
            type: 'boolean',
            description: 'Does anyone in the household have a disability or is aged 60+?',
          },
          hasChildren: {
            type: 'boolean',
            description: 'Are there children under 18 in the household?',
          },
          pregnant: {
            type: 'boolean',
            description: 'Is anyone in the household pregnant?',
          },
        },
        required: ['householdSize', 'monthlyGrossIncome'],
      },

      async execute(
        params: {
          householdSize: number;
          monthlyGrossIncome: number;
          hasElderly?: boolean;
          hasChildren?: boolean;
          pregnant?: boolean;
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, notify } = context;

          // Colorado PEAK screener URL
          await page.navigate('https://peak.my.site.com/peak/s/afb-program-information', {
            waitForSelector: '[data-id="prescreener-form"], form, .slds-form',
            timeout: 15_000,
          });

          notify.info('Running SNAP eligibility pre-screener…');

          // Fill household size
          // NOTE: PEAK uses LWC components. Selector may be inside shadow DOM.
          // If the field isn't found, try: lightning-input[data-name="householdSize"] input
          await page.fillField(
            'input[name="householdSize"], input[data-name="householdSize"], lightning-input[label*="household"] input',
            String(params.householdSize),
          );

          await page.fillField(
            'input[name="monthlyIncome"], input[data-name="monthlyIncome"], lightning-input[label*="income"] input',
            String(params.monthlyGrossIncome),
          );

          if (params.hasElderly) {
            const elderlyCheckbox = await page.exists('input[name="hasElderly"], input[name="hasDisability"]');
            if (elderlyCheckbox) {
              await page.click('input[name="hasElderly"], input[name="hasDisability"]');
            }
          }

          if (params.hasChildren) {
            const childCheckbox = await page.exists('input[name="hasChildren"]');
            if (childCheckbox) {
              await page.click('input[name="hasChildren"]');
            }
          }

          await page.click('button[type="submit"], lightning-button button[type="submit"], .submit-btn', {
            waitForNavigation: false,
          });
          await page.waitForSelector('.results, .eligibility-results, [data-id="results"]', {
            timeout: 10_000,
          });

          // Extract results
          const snapResult = await page.getText('.snap-result, [data-program="SNAP"] .result, .SNAP-eligible');
          const medicaidResult = await page.getText('.medicaid-result, [data-program="Medicaid"] .result');
          const worksResult = await page.getText('.works-result, [data-program="ColoradoWorks"] .result');

          // Client-side SNAP estimate as fallback
          const grossLimit = snapGrossLimit(params.householdSize);
          const estimatedSnapEligible = params.monthlyGrossIncome <= grossLimit;

          return {
            success: true,
            data: {
              estimatedSnapEligible,
              snapGrossIncomeLimit: grossLimit,
              snapResult: snapResult ?? (estimatedSnapEligible ? 'Likely eligible' : 'Likely not eligible'),
              medicaidResult: medicaidResult ?? 'See full screener for Medicaid result',
              coloradoWorksResult: worksResult ?? 'See full screener for Colorado Works result',
              note: 'This is an estimate only. Actual eligibility is determined when you submit a full application.',
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

    // ── start_snap_application ─────────────────────────────────────────────
    {
      name: 'start_snap_application',
      description:
        'Begin a new SNAP application on Colorado PEAK. Requires the user to be logged in. Returns the application ID.',
      inputSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'First name of primary applicant' },
          lastName: { type: 'string', description: 'Last name of primary applicant' },
          dateOfBirth: { type: 'string', description: 'Date of birth in MM/DD/YYYY format' },
          address: {
            type: 'object',
            description: 'Mailing address',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              zip: { type: 'string', pattern: '^\\d{5}$' },
            },
            required: ['street', 'city', 'zip'],
          },
          programs: {
            type: 'array',
            description: 'Programs to apply for',
            items: { type: 'string', enum: ['SNAP', 'Medicaid', 'ColoradoWorks', 'CHP+'] },
          },
        },
        required: ['firstName', 'lastName', 'dateOfBirth', 'address'],
      },

      async execute(
        params: {
          firstName: string;
          lastName: string;
          dateOfBirth: string;
          address: { street: string; city: string; zip: string };
          programs?: string[];
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, notify, storage } = context;

          await page.navigate('https://peak.my.site.com/peak/s/afb-welcome', {
            waitForSelector: 'button, .slds-button',
            timeout: 15_000,
          });

          // Check if logged in
          const loginRequired = await page.exists('.login-form, [data-id="login"]');
          if (loginRequired) {
            return {
              success: false,
              error: 'Login required to start a SNAP application. Please log in to PEAK first.',
              code: 'AUTH_REQUIRED',
            };
          }

          notify.info('Starting SNAP application…');

          // Click "Start a new application"
          await page.click('button[data-id="new-application"], a[href*="apply"], button:has-text("Apply")');
          await context.utils.sleep(1_000);

          // Select programs
          const programs = params.programs ?? ['SNAP'];
          for (const program of programs) {
            const checkbox = await page.exists(`input[value="${program}"], input[name="${program}"]`);
            if (checkbox) {
              await page.click(`input[value="${program}"], input[name="${program}"]`);
            }
          }

          // Fill applicant info
          await page.fillField('input[name="firstName"], lightning-input[label*="First"] input', params.firstName);
          await page.fillField('input[name="lastName"], lightning-input[label*="Last"] input', params.lastName);
          await page.fillField('input[name="dateOfBirth"], lightning-input[label*="Birth"] input', params.dateOfBirth);

          // Address
          await page.fillField('input[name="street"], lightning-input[label*="Street"] input', params.address.street);
          await page.fillField('input[name="city"], lightning-input[label*="City"] input', params.address.city);
          await page.fillField('input[name="zip"], lightning-input[label*="ZIP"] input', params.address.zip);

          await page.click('button[type="submit"]', { waitForNavigation: false });
          await page.waitForSelector('.confirmation, .application-id, [data-id="confirmation"]', {
            timeout: 15_000,
          });

          const applicationId = await page.getText('.application-id, [data-id="app-id"], .confirmation-number');

          // Save to adapter storage
          await storage.set('last_application', {
            id: applicationId,
            startedAt: new Date().toISOString(),
            programs,
          });

          return {
            success: true,
            data: {
              applicationId: applicationId ?? 'See PEAK portal for your application ID',
              programs,
              nextStep: 'Continue your application at https://peak.my.site.com/peak/s/afb-application',
              note: 'Save your application ID. You will need it to check status and upload documents.',
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
      description:
        'Check the status of an existing Colorado PEAK application. Requires login.',
      inputSchema: {
        type: 'object',
        properties: {
          applicationId: {
            type: 'string',
            description: 'PEAK application ID (optional if only one application exists)',
          },
        },
        required: [],
      },

      async execute(
        params: { applicationId?: string },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, notify } = context;

          await page.navigate('https://peak.my.site.com/peak/s/afb-my-applications', {
            waitForSelector: '.applications-list, [data-id="app-list"], .slds-spinner',
            timeout: 15_000,
          });

          const loginRequired = await page.exists('.login-form, [data-id="login"]');
          if (loginRequired) {
            return {
              success: false,
              error: 'Login required to check application status. Please log in to PEAK first.',
              code: 'AUTH_REQUIRED',
            };
          }

          notify.info('Loading application status…');
          await page.waitForSelectorGone('.slds-spinner', { timeout: 10_000 });

          if (params.applicationId) {
            // Try to find this specific application
            const appRow = await page.exists(`[data-app-id="${params.applicationId}"]`);
            if (appRow) {
              await page.click(`[data-app-id="${params.applicationId}"]`);
              await context.utils.sleep(1_000);
            }
          }

          const status = await page.getText('.application-status, [data-id="status"], .status-badge');
          const program = await page.getText('.program-name, [data-id="program"]');
          const lastUpdated = await page.getText('.last-updated, [data-id="last-updated"]');
          const nextAction = await page.getText('.next-action, [data-id="next-action"], .action-needed');

          return {
            success: true,
            data: {
              status: status ?? 'Status not found — check peak.my.site.com directly',
              program,
              lastUpdated,
              nextAction,
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

    // ── get_peak_page_info ─────────────────────────────────────────────────
    {
      name: 'get_peak_page_info',
      description: 'Return information about the current PEAK page — useful for context in multi-step workflows.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        try {
          const url = context.page.currentUrl();
          const pageTitle = await context.page.getText('h1, .page-title, .slds-page-header__title');
          const isLoggedIn = !(await context.page.exists('.login-form, [data-id="login"]'));

          return {
            success: true,
            data: {
              currentUrl: url,
              pageTitle: pageTitle ?? document.title,
              isLoggedIn,
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
