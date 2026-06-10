/**
 * IRS Tax Withholding Estimator — live tests
 * @live — runs against the live app at apps.irs.gov
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

describe('gov.irs.withholding — start_withholding_estimate', () => {
  it('completes About-you for a single filer and reports the income step', { timeout: 90_000 }, async () => {
    const result = await harness.testTool('start_withholding_estimate', {
      filingStatus: 'single',
      age65OrOlder: false,
      isBlind: false,
      claimingDependents: false,
      claimedOnAnotherReturn: false,
    });

    expect(result).toBeToolSuccess();
    if (result.success) {
      expect(result.data['nextStepUrl']).toContain('income');
      expect(String(result.data['siteReportedNextQuestions']).length).toBeGreaterThan(50);
    }
  });
});
