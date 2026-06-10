/**
 * Michigan MI Bridges Adapter
 *
 * Target site: https://newmibridges.michigan.gov (Salesforce Experience Cloud)
 *
 * Entry points verified against the live site on 2026-06-10 (CI runs
 * 27271075100, 27271379213):
 *   landing page  /s/isd-landing-page (root redirects here)
 *   buttons       button[name='guest-afb-btn']    → /s/isd-external-afb-screen
 *                 button[name='find-resource-btn'] → /s/isd-explore-resources
 *                 button[name='login-btn']
 * The deeper application/status flows previously hardcoded here
 * (/s/isd-check-benefits, /s/isd-apply-benefits, /s/isd-my-applications)
 * were never verified and have been replaced with these click-through flows.
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const LANDING_URL = 'https://newmibridges.michigan.gov/';

async function openLanding(context: SandboxContext): Promise<void> {
  await context.page.navigate(LANDING_URL, { timeout: 45_000 });
  await context.utils.sleep(5_000); // Salesforce LWC boot
}

const adapter: AdapterModule = {
  id: 'gov.michigan.bridges',

  tools: [
    // ── explore_resources ────────────────────────────────────────────────
    {
      name: 'explore_resources',
      description:
        'Open MI Bridges "Explore Resources" — Michigan\'s directory of state and ' +
        'community assistance programs (food, housing, utilities, health) — and report ' +
        'what it offers. No login required.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page, utils } = context;
        try {
          await openLanding(context);
          await page.click("button[name='find-resource-btn']", { timeout: 15_000 });
          await utils.sleep(4_000); // route render

          const text = (await page.getText('main')) ?? (await page.getText('body')) ?? '';
          const url = page.currentUrl();

          if (!url.includes('isd-explore-resources')) {
            return {
              success: false,
              error: `Expected the explore-resources page, landed on ${url}`,
              code: 'SITE_CHANGED',
            };
          }

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

    // ── start_application ────────────────────────────────────────────────
    {
      name: 'start_application',
      description:
        'Open the MI Bridges guest application for Michigan benefits (SNAP/FAP, ' +
        'Medicaid, cash assistance) and hand the browser to the user. Nothing is ' +
        'filled or submitted by the agent.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page, utils } = context;
        try {
          await openLanding(context);
          // Verified: routes to /s/isd-external-afb-screen
          await page.click("button[name='guest-afb-btn']", { timeout: 15_000 });
          await utils.sleep(4_000);

          await page.waitForHuman({
            prompt:
              'The MI Bridges application screening is open in the browser.\n\n' +
              '1. Answer the screening questions and continue into the application.\n' +
              '2. Complete the steps yourself (you may be asked to register).\n' +
              '3. Click "Done — continue" here when finished or to stop.',
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
        'Check the status of MI Bridges applications and benefits. Requires an ' +
        'MI Bridges account: the browser pauses for login; the session is then ' +
        'remembered in the active identity.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page, utils } = context;
        try {
          await openLanding(context);
          await page.click("button[name='login-btn']", { timeout: 15_000 });
          await utils.sleep(3_000);

          await page.waitForHuman({
            prompt:
              'MI Bridges needs you to log in. Sign in (including any verification ' +
              'code), navigate to your dashboard/benefits page, then continue. ' +
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
