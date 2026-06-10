/**
 * California BenefitsCal Adapter
 *
 * Target site: https://benefitscal.com — California's OFFICIAL portal for
 * CalFresh (SNAP), CalWORKs, Medi-Cal, and General Assistance.
 *
 * Entry points verified against the live site on 2026-06-10 (CI runs
 * 27269295403 and 27269590345):
 *   - homepage buttons: #HomePage_doIQualify_btn, #HomePage_login_btn,
 *     #HomePage_create_account_btn
 *   - official application start (the URL GetCalFresh routes everyone to):
 *     /ApplyForBenefits/begin/ABOVR?lang=en
 * The screener/application flows beyond these entry points are an Angular
 * SPA and are reported as the site presents them, not automated blindly.
 *
 * Tools:
 *   - check_eligibility:  open the "Do I Qualify" screener and report it
 *   - get_case_status:    case dashboard (login handoff; session persists
 *                          in the identity's browser profile)
 *   - start_application:  open the official application and hand to human
 */

import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';

const BASE = 'https://benefitscal.com';
const APPLY_BEGIN_URL = `${BASE}/ApplyForBenefits/begin/ABOVR?lang=en`;

const adapter: AdapterModule = {
  id: 'gov.california.benefitscal',

  tools: [
    // ── check_eligibility ────────────────────────────────────────────────
    {
      name: 'check_eligibility',
      description:
        'Open the BenefitsCal "Do I Qualify" screener for California benefits ' +
        '(CalFresh, CalWORKs, Medi-Cal) and report what it asks. No login required. ' +
        'The screener is interactive — this tool reports the site\'s questions and ' +
        'content rather than answering on its own.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page, utils } = context;
        try {
          await page.navigate(`${BASE}/`, { timeout: 45_000 });
          await utils.sleep(4_000); // Angular boot + personalization framework

          // Verified entry button (live probe 2026-06-10). The homepage runs a
          // personalization framework (lift-ux), so the button occasionally
          // renders late or not at all — degrade gracefully to homepage info.
          let opened = false;
          if (await page.exists('#HomePage_doIQualify_btn')) {
            await page.click('#HomePage_doIQualify_btn', { timeout: 15_000 });
            await utils.sleep(3_000); // route/modal render
            opened = true;
          }

          const screenerText =
            (await page.getText('main')) ?? (await page.getText('body')) ?? '';

          return {
            success: true,
            data: {
              screenerOpened: opened,
              siteReportedContent: screenerText.replace(/\s+/g, ' ').trim().slice(0, 2_500),
              currentUrl: page.currentUrl(),
              note: opened
                ? 'Pre-screening only — not an eligibility determination. Apply to get a real decision.'
                : 'The "Do I Qualify" button was not present on this page load (BenefitsCal personalizes its homepage). Reported the homepage content instead.',
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
        'Requires a BenefitsCal account: the browser pauses so the user can log in; ' +
        'the session is then remembered in the active identity.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page, utils } = context;
        try {
          await page.navigate(`${BASE}/`, {
            waitForSelector: '#HomePage_login_btn',
            timeout: 30_000,
          });
          // Verified login button (live probe 2026-06-10)
          await page.click('#HomePage_login_btn', { timeout: 15_000 });
          await utils.sleep(2_000);

          await page.waitForHuman({
            prompt:
              'BenefitsCal needs you to log in. Sign in (including any code sent to ' +
              'your phone/email), navigate to your dashboard, then continue. ' +
              'Your session will be remembered.',
            timeout: 10 * 60 * 1_000,
          });

          const casesText = (await page.getText('main')) ?? (await page.getText('body')) ?? '';

          return {
            success: true,
            data: {
              siteReportedContent: casesText.replace(/\s+/g, ' ').trim().slice(0, 2_500),
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

    // ── start_application ────────────────────────────────────────────────
    {
      name: 'start_application',
      description:
        'Open the official BenefitsCal application for California benefits (CalFresh, ' +
        'CalWORKs, Medi-Cal) and hand the browser to the user. This is the same URL ' +
        'GetCalFresh routes applicants to. Nothing is filled or submitted by the agent.',
      inputSchema: { type: 'object', properties: {} },

      async execute(_params: Record<string, never>, context: SandboxContext): Promise<ToolResult> {
        const { page } = context;
        try {
          // Verified application entry URL (live probe 2026-06-10 — the link
          // getcalfresh.org publishes as the official apply path)
          await page.navigate(APPLY_BEGIN_URL, { timeout: 30_000 });

          await page.waitForHuman({
            prompt:
              'The BenefitsCal application is open in the browser.\n\n' +
              '1. Create an account or continue as guest if offered.\n' +
              '2. Complete the application steps yourself.\n' +
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
  ],
};

export default adapter;
