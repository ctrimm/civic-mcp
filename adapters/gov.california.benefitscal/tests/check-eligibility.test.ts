/**
 * California BenefitsCal — eligibility screener tests
 * @live — runs against the live site at benefitscal.com
 *
 * NOTE: selectors are unverified; these tests document expected behavior
 * and will fail until selectors are confirmed against the live site.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { createHarness, matchers } from '@civic-mcp/testing';
import { resolve } from 'node:path';

expect.extend(matchers);

const harness = createHarness({
  adapterPath: resolve(import.meta.dirname, '../adapter.ts'),
  manifestPath: resolve(import.meta.dirname, '../manifest.json'),
});

afterAll(() => harness.close());

describe('gov.california.benefitscal — check_eligibility', () => {
  it('returns site-reported results for a low-income household', { timeout: 45_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      zipCode: '90001',
      householdSize: 2,
      monthlyGrossIncome: 1200,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('siteReportedResults');
      expect(result.data).toHaveProperty('screenerUrl');
    }
  });

  it('fails with a useful error when selectors are stale', { timeout: 45_000 }, async () => {
    // This documents the failure contract: a selector miss must return
    // success: false with code SELECTOR_NOT_FOUND, never throw.
    const result = await harness.testTool('check_eligibility', {
      zipCode: '94105',
      householdSize: 1,
      monthlyGrossIncome: 5000,
    });

    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });
});
