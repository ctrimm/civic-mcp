/**
 * Michigan MI Bridges — eligibility screener tests
 * @live — runs against the live site at newmibridges.michigan.gov
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

describe('gov.michigan.bridges — check_eligibility', () => {
  it('returns eligibility estimate for valid inputs', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      householdSize: 3,
      monthlyGrossIncome: 2_000,
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
      monthlyGrossIncome: 500,
    });

    expect(result).toHaveProperty('success');
  });

  it('includes county in request when provided', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      householdSize: 2,
      monthlyGrossIncome: 1_500,
      county: 'Wayne',
    });

    expect(result).toHaveProperty('success');
  });
});

describe('gov.michigan.bridges — check_application_status (requires auth)', () => {
  it.skip('returns auth error when not logged in', { timeout: 15_000 }, async () => {
    const result = await harness.testTool('check_application_status', {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect((result as { code: string }).code).toBe('AUTH_REQUIRED');
    }
  });
});
