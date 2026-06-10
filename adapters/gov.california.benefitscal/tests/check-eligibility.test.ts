/**
 * California BenefitsCal — live tests
 * @live — runs against the live site at benefitscal.com
 */

import { describe, it, expect, afterAll } from 'vitest';
import { createHarness, HumanRequiredError, matchers } from '@civic-mcp/testing';
import { resolve } from 'node:path';

expect.extend(matchers);

const harness = createHarness({
  adapterPath: resolve(import.meta.dirname, '../adapter.ts'),
  manifestPath: resolve(import.meta.dirname, '../manifest.json'),
});

afterAll(() => harness.close());

describe('gov.california.benefitscal — check_eligibility', () => {
  it('opens the Do I Qualify screener and reports its content', { timeout: 60_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {});

    expect(result).toBeToolSuccess();
    if (result.success) {
      expect(String(result.data['siteReportedContent']).length).toBeGreaterThan(50);
    }
  });
});

describe('gov.california.benefitscal — start_application (human handoff)', () => {
  it('opens the official application / raises HumanRequiredError headless', { timeout: 60_000 }, async () => {
    try {
      const result = await harness.testTool('start_application', {});
      expect(result).toBeToolSuccess(); // headed: human finished
    } catch (err) {
      if (err instanceof HumanRequiredError) return; // headless: expected
      throw err;
    }
  });
});
