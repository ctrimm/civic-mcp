/**
 * Colorado PEAK — eligibility screener tests
 * @live — runs against the live site at peak.my.site.com
 */

import { describe, it, expect, afterAll } from 'vitest';
import { createHarness, TEST_HOUSEHOLDS, matchers } from '@civic-mcp/testing';
import { resolve } from 'node:path';

expect.extend(matchers);

const harness = createHarness({
  adapterPath: resolve(import.meta.dirname, '../adapter.ts'),
  manifestPath: resolve(import.meta.dirname, '../manifest.json'),
});

afterAll(() => harness.close());

describe('gov.colorado.peak — check_program_eligibility', () => {
  it(
    'returns eligibility estimate for a low-income single adult',
    { timeout: 30_000 },
    async () => {
      const result = await harness.testTool('check_program_eligibility', {
        ...TEST_HOUSEHOLDS.single_low_income,
        monthlyGrossIncome: TEST_HOUSEHOLDS.single_low_income.monthlyIncome,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('estimatedSnapEligible');
        expect(result.data['estimatedSnapEligible']).toBe(true);
        expect(result.data).toHaveProperty('snapGrossIncomeLimit');
      }
    },
  );

  it(
    'returns ineligible estimate for a high-income family',
    { timeout: 30_000 },
    async () => {
      const result = await harness.testTool('check_program_eligibility', {
        householdSize: 2,
        monthlyGrossIncome: 10_000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data['estimatedSnapEligible']).toBe(false);
      }
    },
  );

  it('handles minimum valid inputs', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_program_eligibility', {
      householdSize: 1,
      monthlyGrossIncome: 0,
    });

    expect(result).toHaveProperty('success');
  });
});

describe('gov.colorado.peak — get_peak_page_info', () => {
  it('returns current page info', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('get_peak_page_info', {});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data['currentUrl']).toBe('string');
      expect(typeof result.data['isLoggedIn']).toBe('boolean');
    }
  });
});

describe('gov.colorado.peak — check_application_status (requires auth)', () => {
  it.skip('returns application status when logged in', { timeout: 30_000 }, async () => {
    // @authenticated — skip unless PEAK_SESSION_COOKIE is set
    const result = await harness.testTool('check_application_status', {});
    expect(result.success).toBe(true);
  });
});
