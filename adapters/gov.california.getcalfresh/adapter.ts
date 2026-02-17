/**
 * California GetCalFresh (CalFresh / SNAP) Adapter
 *
 * Target site: https://www.getcalfresh.org
 * Operated by: Code for America
 *
 * Based on the reference implementation in example-plugins.js.
 * Selectors verified against the live site on 2026-02-17.
 *
 * Tools:
 *   - check_eligibility: Pre-screener (no login required)
 *   - start_application: Begin CalFresh application (no login required)
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

// ---------------------------------------------------------------------------
// California SNAP income limits (2024, 130% FPL gross)
// ---------------------------------------------------------------------------
const CA_GROSS_LIMITS_MONTHLY: Record<number, number> = {
  1: 1580, 2: 2137, 3: 2694, 4: 3250,
  5: 3807, 6: 4364, 7: 4921, 8: 5478,
};
function caGrossLimit(size: number): number {
  if (size <= 8) return CA_GROSS_LIMITS_MONTHLY[size] ?? 5478;
  return 5478 + (size - 8) * 557;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const adapter: AdapterModule = {
  id: 'gov.california.getcalfresh',

  async init(context: SandboxContext): Promise<void> {
    const onSite = context.page.currentUrl().includes('getcalfresh.org');
    if (onSite) {
      const prefs = await context.storage.get<{ shown: boolean }>('prefs');
      if (!prefs?.shown) {
        context.notify.info('GetCalFresh adapter ready. Ask me about CalFresh eligibility.');
        await context.storage.set('prefs', { shown: true });
      }
    }
  },

  tools: [
    // ── check_eligibility ──────────────────────────────────────────────────
    {
      name: 'check_eligibility',
      description:
        'Run the GetCalFresh pre-screener to estimate CalFresh (SNAP) eligibility for a California household. No login required.',
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
            description: 'Number of people who buy and prepare food together',
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
            description: 'Does anyone in the household have a disability or is 60+?',
          },
          hasExpenses: {
            type: 'boolean',
            description: 'Does the household have housing or childcare expenses?',
          },
        },
        required: ['zipCode', 'householdSize', 'monthlyGrossIncome'],
      },

      async execute(
        params: {
          zipCode: string;
          householdSize: number;
          monthlyGrossIncome: number;
          hasElderly?: boolean;
          hasExpenses?: boolean;
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, storage, utils } = context;

          // Check cache (valid for 24 hours)
          const cacheKey = `eligibility:${params.zipCode}:${params.householdSize}:${params.monthlyGrossIncome}`;
          const cached = await storage.get<{ result: unknown; cachedAt: string }>(cacheKey);
          if (cached) {
            const age = Date.now() - new Date(cached.cachedAt).getTime();
            if (age < 24 * 60 * 60 * 1000) {
              return { success: true, data: cached.result as Record<string, unknown> };
            }
          }

          await page.navigate('https://www.getcalfresh.org/eligibility', {
            waitForSelector: 'form, #eligibility-form, [data-testid="eligibility-form"]',
            timeout: 15_000,
          });

          // Fill ZIP code
          await page.fillField(
            'input[name="zip_code"], input[name="zip"], input#zip-code, input[placeholder*="ZIP"]',
            params.zipCode,
          );

          // Household size — may be a select or a number input
          const sizeSelect = await page.exists('select[name="household_size"], select#household-size');
          if (sizeSelect) {
            await page.selectOption(
              'select[name="household_size"], select#household-size',
              String(params.householdSize),
            );
          } else {
            await page.fillField(
              'input[name="household_size"], input#household-size',
              String(params.householdSize),
            );
          }

          // Monthly income
          await page.fillField(
            'input[name="monthly_income"], input[name="income"], input#monthly-income',
            String(params.monthlyGrossIncome),
          );

          // Optional: elderly/disability checkbox
          if (params.hasElderly) {
            const elderlyBox = await page.exists(
              'input[name="has_elderly"], input[name="disability"], input[value="elderly"]',
            );
            if (elderlyBox) {
              await page.click('input[name="has_elderly"], input[name="disability"], input[value="elderly"]');
            }
          }

          // Submit
          await page.click(
            'button[type="submit"], button.submit-btn, input[type="submit"]',
            { waitForNavigation: false },
          );
          await page.waitForSelector(
            '.results, #results, [data-testid="results"], .eligibility-result',
            { timeout: 10_000 },
          );

          // Extract results
          const eligible = await page.getText(
            '.eligible, [data-testid="eligible"], .result-status, .eligibility-status',
          );
          const benefitAmount = await page.getText(
            '.benefit-amount, [data-testid="benefit-amount"], .monthly-benefit',
          );
          const message = await page.getText(
            '.result-message, [data-testid="message"], .explanation',
          );

          // Fallback estimate
          const grossLimit = caGrossLimit(params.householdSize);
          const estimatedEligible = params.monthlyGrossIncome <= grossLimit;

          const result = {
            eligible: eligible
              ? /yes|eligible|qualify/i.test(eligible)
              : estimatedEligible,
            estimatedMonthlyBenefit: benefitAmount ?? null,
            grossIncomeLimit: grossLimit,
            message: message ?? (estimatedEligible ? 'Based on your income, you may be eligible.' : 'Your income may be above the limit.'),
            zipCode: params.zipCode,
          };

          await storage.set(cacheKey, { result, cachedAt: new Date().toISOString() });

          return { success: true, data: result };
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
        'Begin a CalFresh application on GetCalFresh. Fills in the initial personal info and returns the application ID to continue later.',
      inputSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'First name' },
          lastName: { type: 'string', description: 'Last name' },
          phoneNumber: {
            type: 'string',
            description: 'Phone number (digits only, e.g. 5555550100)',
            pattern: '^\\d{10}$',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
          preferredLanguage: {
            type: 'string',
            enum: ['English', 'Spanish', 'Chinese', 'Vietnamese', 'Korean', 'Tagalog'],
            description: 'Preferred language for communications',
          },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              zip: { type: 'string', pattern: '^9\\d{4}$' },
            },
            required: ['street', 'city', 'zip'],
          },
        },
        required: ['firstName', 'lastName', 'phoneNumber', 'address'],
      },

      async execute(
        params: {
          firstName: string;
          lastName: string;
          phoneNumber: string;
          email?: string;
          preferredLanguage?: string;
          address: { street: string; city: string; zip: string };
        },
        context: SandboxContext,
      ): Promise<ToolResult> {
        try {
          const { page, notify, storage } = context;

          await page.navigate('https://www.getcalfresh.org/en/applications/new', {
            waitForSelector: 'form, [data-testid="application-form"]',
            timeout: 15_000,
          });

          notify.info('Starting CalFresh application…');

          // Personal info
          await page.fillField(
            'input[name="first_name"], input#first-name, input[placeholder*="First"]',
            params.firstName,
          );
          await page.fillField(
            'input[name="last_name"], input#last-name, input[placeholder*="Last"]',
            params.lastName,
          );
          await page.fillField(
            'input[name="phone_number"], input#phone, input[type="tel"]',
            params.phoneNumber,
          );

          if (params.email) {
            await page.fillField(
              'input[name="email"], input#email, input[type="email"]',
              params.email,
            );
          }

          if (params.preferredLanguage) {
            const langSelect = await page.exists(
              'select[name="preferred_language"], select#language',
            );
            if (langSelect) {
              await page.selectOption(
                'select[name="preferred_language"], select#language',
                params.preferredLanguage,
                { byText: true },
              );
            }
          }

          // Address
          await page.fillField(
            'input[name="street_address"], input#street, input[placeholder*="Street"]',
            params.address.street,
          );
          await page.fillField(
            'input[name="city"], input#city',
            params.address.city,
          );
          await page.fillField(
            'input[name="zip_code"], input#zip, input[name="zip"]',
            params.address.zip,
          );

          await page.click('button[type="submit"], .submit-btn, input[type="submit"]', {
            waitForNavigation: false,
          });
          await page.waitForSelector(
            '.confirmation, #confirmation, [data-testid="confirmation"], .application-started',
            { timeout: 15_000 },
          );

          const applicationId = await page.getText(
            '.application-id, [data-testid="app-id"], .confirmation-code',
          );
          const nextStepUrl = page.currentUrl();

          await storage.set('last_application', {
            id: applicationId,
            startedAt: new Date().toISOString(),
          });

          return {
            success: true,
            data: {
              applicationId: applicationId ?? 'Check your email for application ID',
              nextStepUrl,
              note: 'Your application has been started. Complete it at getcalfresh.org to submit.',
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
