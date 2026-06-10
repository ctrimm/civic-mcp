/**
 * Texas YourTexasBenefits — eligibility screener tests
 * @live — runs against the live site at yourtexasbenefits.com
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

describe('gov.texas.yourtexasbenefits — check_eligibility', () => {
  it('returns eligibility estimate for a family with children', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      householdSize: 4,
      monthlyGrossIncome: 2_200,
      hasChildren: true,
    });

    expect(result).toHaveProperty('success');
    if (result.success) {
      expect(result.data).toHaveProperty('snapResult');
    }
  });

  it('handles minimum required inputs', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      householdSize: 1,
      monthlyGrossIncome: 800,
    });

    expect(result).toHaveProperty('success');
  });

  it('includes county when provided', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      householdSize: 2,
      monthlyGrossIncome: 1_800,
      county: 'Harris',
    });

    expect(result).toHaveProperty('success');
  });
});

describe('gov.texas.yourtexasbenefits — get_benefit_status (requires auth)', () => {
  it.skip('returns auth error when not logged in', { timeout: 15_000 }, async () => {
    const result = await harness.testTool('get_benefit_status', {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect((result as { code: string }).code).toBe('AUTH_REQUIRED');
    }
  });
});
