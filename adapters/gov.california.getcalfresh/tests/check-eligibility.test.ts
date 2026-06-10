/**
 * California GetCalFresh — live tests
 * @live — runs against the live site at getcalfresh.org
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

describe('gov.california.getcalfresh — get_application_info', () => {
  it('reports application info and the official BenefitsCal apply URL', { timeout: 45_000 }, async () => {
    const result = await harness.testTool('get_application_info', {});

    expect(result).toBeToolSuccess();
    if (result.success) {
      expect(String(result.data['siteReportedInfo']).length).toBeGreaterThan(50);
      expect(result.data['officialApplyUrl']).toContain('benefitscal.com');
      expect(String(result.data['siteReportedInfo']).toLowerCase()).toContain('calfresh');
    }
  });
});
