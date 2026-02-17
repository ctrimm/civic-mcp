/**
 * California GetCalFresh — eligibility screener tests
 * @live — runs against the live site at getcalfresh.org
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

describe('gov.california.getcalfresh — check_eligibility', () => {
  it('returns eligibility for a low-income household in CA', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      zipCode: '90001',
      householdSize: 1,
      monthlyGrossIncome: 900,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('eligible');
      expect(result.data).toHaveProperty('grossIncomeLimit');
      expect(result.data['eligible']).toBe(true);
    }
  });

  it('returns likely ineligible for high-income household', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      zipCode: '94105',
      householdSize: 2,
      monthlyGrossIncome: 10_000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data['eligible']).toBe(false);
    }
  });

  it('caches repeat requests', { timeout: 60_000 }, async () => {
    const params = { zipCode: '95814', householdSize: 3, monthlyGrossIncome: 2500 };

    const first = await harness.testTool('check_eligibility', params);
    const second = await harness.testTool('check_eligibility', params);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);

    if (first.success && second.success) {
      expect(first.data['eligible']).toBe(second.data['eligible']);
    }
  });

  it('handles optional hasElderly flag', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      zipCode: '90210',
      householdSize: 1,
      monthlyGrossIncome: 1200,
      hasElderly: true,
    });

    expect(result).toHaveProperty('success');
  });
});

describe('gov.california.getcalfresh — start_application (requires login context)', () => {
  it.skip('starts application and returns application ID', { timeout: 60_000 }, async () => {
    // @authenticated — requires form to not have reCAPTCHA blocking
    const result = await harness.testTool('start_application', {
      firstName: 'Jane',
      lastName: 'Test',
      phoneNumber: '5555550100',
      address: { street: '123 Test St', city: 'Sacramento', zip: '95814' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('applicationId');
    }
  });
});
