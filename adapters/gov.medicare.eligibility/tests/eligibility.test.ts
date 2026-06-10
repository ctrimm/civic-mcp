/**
 * Medicare Eligibility Calculator — live tests
 * @live — runs against the live site at medicare.gov
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

describe('gov.medicare.eligibility — check_medicare_eligibility', () => {
  it('reports eligibility for someone already 65+', { timeout: 60_000 }, async () => {
    const result = await harness.testTool('check_medicare_eligibility', {
      birthMonth: 4,
      birthDay: 12,
      birthYear: 1958,
      workedTenYearsPayingMedicareTaxes: true,
    });

    expect(result).toBeToolSuccess();
    if (result.success) {
      const text = String(result.data['siteReportedResults']).toLowerCase();
      expect(text.length).toBeGreaterThan(50);
      expect(text).toMatch(/medicare|eligib|premium|part a/);
    }
  });

  it('reports a future eligibility date for someone under 65', { timeout: 60_000 }, async () => {
    const result = await harness.testTool('check_medicare_eligibility', {
      birthMonth: 9,
      birthDay: 1,
      birthYear: 1975,
      workedTenYearsPayingMedicareTaxes: true,
    });

    expect(result).toBeToolSuccess();
    if (result.success) {
      expect(String(result.data['siteReportedResults']).length).toBeGreaterThan(50);
    }
  });
});
