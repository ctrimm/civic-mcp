/**
 * Federal Student Aid Estimator — tests
 *
 * @live-blocked: studentaid.gov rejects datacenter IPs (HTTP/2 protocol
 * errors / timeouts from GitHub-hosted runners — see CI runs 27269295403 and
 * 27269590345). These tests are skipped in CI; run them locally from a
 * residential connection with:
 *   CIVIC_MCP_HEADED=1 pnpm exec vitest run adapters/gov.studentaid.estimator
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

const runLive = process.env['CIVIC_MCP_STUDENTAID_LIVE'] === '1';

describe('gov.studentaid.estimator — open_aid_estimator', () => {
  it.skipIf(!runLive)(
    'opens the estimator and hands off (requires residential IP: set CIVIC_MCP_STUDENTAID_LIVE=1)',
    { timeout: 35 * 60 * 1_000 },
    async () => {
      try {
        const result = await harness.testTool('open_aid_estimator', {});
        expect(result).toBeToolSuccess();
      } catch (err) {
        if (err instanceof HumanRequiredError) return; // headless: expected
        throw err;
      }
    },
  );

  it('adapter module loads and declares the tool', async () => {
    const mod = await import('../adapter.ts');
    const names = mod.default.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('open_aid_estimator');
  });
});
