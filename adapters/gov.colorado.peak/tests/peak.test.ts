/**
 * Colorado PEAK — live tests
 * @live — runs against the live site at peak.my.site.com
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

describe('gov.colorado.peak — find_benefits', () => {
  it('opens the benefits directory and reports its content', { timeout: 90_000 }, async () => {
    const result = await harness.testTool('find_benefits', {});

    expect(result).toBeToolSuccess();
    if (result.success) {
      expect(result.data['currentUrl']).toContain('benefit-information');
      expect(String(result.data['siteReportedContent']).length).toBeGreaterThan(20);
    }
  });
});

describe('gov.colorado.peak — open_benefits_finder', () => {
  it('opens the interactive benefits finder', { timeout: 90_000 }, async () => {
    const result = await harness.testTool('open_benefits_finder', {});

    expect(result).toBeToolSuccess();
    if (result.success) {
      expect(result.data['currentUrl']).toContain('get-help-finding-benefits');
    }
  });
});

describe('gov.colorado.peak — start_application (human handoff)', () => {
  it('opens the guest application / raises HumanRequiredError headless', { timeout: 90_000 }, async () => {
    try {
      const result = await harness.testTool('start_application', {});
      expect(result).toBeToolSuccess(); // headed: human finished
    } catch (err) {
      if (err instanceof HumanRequiredError) return; // headless: expected
      throw err;
    }
  });
});
