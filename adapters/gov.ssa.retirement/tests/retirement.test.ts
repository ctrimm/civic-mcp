/**
 * Social Security Retirement Benefits — adapter tests
 * @live — runs against the live site at ssa.gov
 *
 * Running modes
 * ─────────────
 * Headless (default / CI):
 *   pnpm --filter @civic-mcp/testing exec vitest run adapters/gov.ssa.retirement
 *
 *   • estimate_retirement_benefit runs fully automatically.
 *   • start_retirement_application is skipped — it calls waitForHuman() which
 *     throws HumanRequiredError in headless mode.
 *
 * Headed (demo / manual):
 *   CIVIC_MCP_HEADED=1 pnpm --filter @civic-mcp/testing exec vitest run adapters/gov.ssa.retirement
 *
 *   • Both tools run. When the application hits the reCAPTCHA step the
 *     terminal prints the prompt and waits for you to press Enter after
 *     solving it in the browser window — perfect for recording a demo.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { createHarness, HumanRequiredError, matchers } from '@civic-mcp/testing';
import { resolve } from 'node:path';

expect.extend(matchers);

const harness = createHarness({
  adapterPath:   resolve(import.meta.dirname, '../adapter.ts'),
  manifestPath:  resolve(import.meta.dirname, '../manifest.json'),
  headed:        process.env['CIVIC_MCP_HEADED'] === '1',
});

afterAll(() => harness.close());

// ---------------------------------------------------------------------------
// estimate_retirement_benefit — fully autonomous, no human needed
// ---------------------------------------------------------------------------

describe('gov.ssa.retirement — estimate_retirement_benefit', () => {
  it(
    'returns benefit estimates for a mid-career worker',
    { timeout: 45_000 },
    async () => {
      const result = await harness.testTool('estimate_retirement_benefit', {
        birthYear:              1975,
        currentAnnualEarnings:  65_000,
      });

      expect(result).toBeToolSuccess();
      if (result.success) {
        const est = result.data['estimatedMonthlyBenefit'] as Record<string, number | null>;
        expect(est).toHaveProperty('atAge62');
        expect(est).toHaveProperty('atFullRetirementAge');
        expect(est).toHaveProperty('atAge70');
        expect(result.data['fullRetirementAge']).toBe('67'); // born 1975
      }
    },
  );

  it(
    'estimates are higher at 70 than at 62',
    { timeout: 45_000 },
    async () => {
      const result = await harness.testTool('estimate_retirement_benefit', {
        birthYear:             1968,
        currentAnnualEarnings: 80_000,
      });

      expect(result).toBeToolSuccess();
      if (result.success) {
        const est = result.data['estimatedMonthlyBenefit'] as Record<string, number | null>;
        if (est.atAge62 !== null && est.atAge70 !== null) {
          expect(est.atAge70).toBeGreaterThan(est.atAge62);
        }
      }
    },
  );

  it(
    'caches repeat requests (second call is faster)',
    { timeout: 60_000 },
    async () => {
      const params = { birthYear: 1970, currentAnnualEarnings: 55_000 };

      const t0 = Date.now();
      const first = await harness.testTool('estimate_retirement_benefit', params);
      const firstMs = Date.now() - t0;

      const t1 = Date.now();
      const second = await harness.testTool('estimate_retirement_benefit', params);
      const secondMs = Date.now() - t1;

      expect(first).toBeToolSuccess();
      expect(second).toBeToolSuccess();

      if (first.success && second.success) {
        expect(first.data['birthYear']).toBe(second.data['birthYear']);
        // Cached call should be substantially faster
        expect(secondMs).toBeLessThan(firstMs * 0.5);
      }
    },
  );

  it(
    'handles minimum income (zero earnings)',
    { timeout: 45_000 },
    async () => {
      const result = await harness.testTool('estimate_retirement_benefit', {
        birthYear:             1960,
        currentAnnualEarnings: 0,
      });
      // Should succeed or return a graceful error — not crash
      expect(result).toHaveProperty('success');
    },
  );
});

// ---------------------------------------------------------------------------
// start_retirement_application — requires human for reCAPTCHA
// ---------------------------------------------------------------------------

describe('gov.ssa.retirement — start_retirement_application', () => {
  it(
    'fills personal info and pauses for reCAPTCHA (headed) / skips gracefully (headless)',
    { timeout: 15 * 60 * 1_000 }, // 15 min — human needs time to solve CAPTCHA
    async () => {
      try {
        const result = await harness.testTool('start_retirement_application', {
          dateOfBirth: '01/15/1958',
          firstName:   'Jane',
          lastName:    'Demo',
          phone:       '5555550100',
        });

        // If we reach here, we're running headed and the human solved the CAPTCHA
        expect(result).toBeToolSuccess();
        if (result.success) {
          expect(result.data).toHaveProperty('confirmationNumber');
          expect(result.data).toHaveProperty('applicationUrl');
          console.log('\n✅ Application submitted!');
          console.log('   Confirmation:', result.data['confirmationNumber']);
          console.log('   URL:         ', result.data['applicationUrl']);
        }
      } catch (err) {
        if (err instanceof HumanRequiredError) {
          // Headless mode — expected. Log clearly for CI output.
          console.log(
            '\n⏭  Skipped: start_retirement_application requires a human to solve the',
            `reCAPTCHA step.\n   Prompt shown to user: "${err.humanPrompt}"`,
            '\n   Run with CIVIC_MCP_HEADED=1 to execute this tool interactively.',
          );
          return; // pass the test
        }
        throw err; // unexpected error — fail the test
      }
    },
  );
});
