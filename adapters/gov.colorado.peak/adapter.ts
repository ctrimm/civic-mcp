/**
 * Colorado PEAK Adapter
 *
 * Target site: https://peak.my.site.com (Salesforce Experience Cloud / LWC)
 *
 * Public routes verified against the live site on 2026-06-10 (CI run
 * 27271735544) — note the site roots (/ and /peak/s/) redirect to login,
 * but these deep routes are public:
 *   /peak/s/afb-welcome                button[name='ApplyAsGuest'],
 *                                      button[name='SignIn'],
 *                                      button[name='CreatePEAKAccount']
 *   /peak/s/benefit-information        "Find benefits" directory
 *   /peak/s/get-help-finding-benefits  benefits finder (category checkboxes)
 * The previously hardcoded routes (afb-program-information, afb-application,
 * afb-my-applications) were never verified and have been replaced.
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const BASE = 'https://peak.my.site.com/peak/s';

async function openRoute(context: SandboxContext, route: string): Promise<void> {
  await context.page.navigate(`${BASE}/${route}?language=en_US`, { timeout: 45_000 });
  await context.utils.sleep(5_000); // Salesforce LWC boot
}

const adapter: AdapterModule = {
  id: 'gov.colorado.peak',

  tools: [
    // ── find_benefits ────────────────────────────────────────────────────
    {
      name: 'find_benefits',
      description:
        'Open Colorado PEAK\'s "Find benefits" directory — descriptions of SNAP, ' +
        'Medicaid (Health First Colorado), Colorado Works/TANF, CHP+, and other ' +
        'programs — and report what the site says. No login required.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page } = context;
        try {
          await openRoute(context, 'benefit-information');
          const url = page.currentUrl();
          if (!url.includes('benefit-information')) {
            return {
              success: false,
              error: `Expected the benefit-information page, landed on ${url}`,
              code: 'SITE_CHANGED',
            };
          }
          const text = (await page.getText('main')) ?? (await page.getText('body')) ?? '';
          return {
            success: true,
            data: {
              siteReportedContent: text.replace(/\s+/g, ' ').trim().slice(0, 2_500),
              currentUrl: url,
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

    // ── open_benefits_finder ─────────────────────────────────────────────
    {
      name: 'open_benefits_finder',
      description:
        'Open Colorado PEAK\'s interactive benefits finder (category checkboxes for ' +
        'food, health, cash, housing, child care, …) and report what it asks. No ' +
        'login required. The finder is interactive — this tool reports the site\'s ' +
        'questions rather than answering on its own.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page } = context;
        try {
          await openRoute(context, 'get-help-finding-benefits');
          const url = page.currentUrl();
          if (!url.includes('get-help-finding-benefits')) {
            return {
              success: false,
              error: `Expected the benefits finder, landed on ${url}`,
              code: 'SITE_CHANGED',
            };
          }
          const text = (await page.getText('main')) ?? (await page.getText('body')) ?? '';
          return {
            success: true,
            data: {
              siteReportedContent: text.replace(/\s+/g, ' ').trim().slice(0, 2_500),
              currentUrl: url,
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

    // ── start_application ────────────────────────────────────────────────
    {
      name: 'start_application',
      description:
        'Open the Colorado PEAK application for state benefits (SNAP, Health First ' +
        'Colorado, Colorado Works, CHP+) as a guest and hand the browser to the user. ' +
        'Nothing is filled or submitted by the agent.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page, utils } = context;
        try {
          await openRoute(context, 'afb-welcome');
          // Verified guest-application button (live probe 2026-06-10)
          await page.click("button[name='ApplyAsGuest']", { timeout: 15_000 });
          await utils.sleep(4_000);

          await page.waitForHuman({
            prompt:
              'The Colorado PEAK application is open in the browser (guest mode).\n\n' +
              '1. Complete the application steps yourself.\n' +
              '2. Click "Done — continue" here when finished or to stop.',
            timeout: 30 * 60 * 1_000,
          });

          return {
            success: true,
            data: {
              currentUrl: page.currentUrl(),
              note: 'Browser was handed to the user. Nothing was filled or submitted by the agent.',
            },
          };
        } catch (err) {
          if (err instanceof Error && err.name === 'HumanRequiredError') throw err;
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            code: 'UNKNOWN',
          };
        }
      },
    },

    // ── check_application_status ─────────────────────────────────────────
    {
      name: 'check_application_status',
      description:
        'Check the status of Colorado PEAK applications and benefits. Requires a ' +
        'PEAK account: the browser pauses for login; the session is then remembered ' +
        'in the active identity.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page, utils } = context;
        try {
          await openRoute(context, 'afb-welcome');
          // Verified sign-in button (live probe 2026-06-10)
          await page.click("button[name='SignIn']", { timeout: 15_000 });
          await utils.sleep(3_000);

          await page.waitForHuman({
            prompt:
              'Colorado PEAK needs you to log in. Sign in (including any verification ' +
              'code), navigate to your applications/benefits page, then continue. ' +
              'Your session will be remembered.',
            timeout: 10 * 60 * 1_000,
          });

          const text = (await page.getText('main')) ?? (await page.getText('body')) ?? '';
          return {
            success: true,
            data: {
              siteReportedContent: text.replace(/\s+/g, ' ').trim().slice(0, 2_500),
              currentUrl: page.currentUrl(),
            },
          };
        } catch (err) {
          if (err instanceof Error && err.name === 'HumanRequiredError') throw err;
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
