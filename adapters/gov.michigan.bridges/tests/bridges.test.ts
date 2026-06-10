/**
 * Michigan MI Bridges — live tests
 * @live — runs against the live site at newmibridges.michigan.gov
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

describe('gov.michigan.bridges — explore_resources', () => {
  it('opens the resource explorer and reports its content', { timeout: 90_000 }, async () => {
    const result = await harness.testTool('explore_resources', {});

    expect(result).toBeToolSuccess();
    if (result.success) {
      expect(result.data['currentUrl']).toContain('isd-explore-resources');
      expect(String(result.data['siteReportedContent']).length).toBeGreaterThan(20);
    }
  });
});

describe('gov.michigan.bridges — start_application (human handoff)', () => {
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
