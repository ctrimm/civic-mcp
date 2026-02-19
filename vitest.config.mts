/**
 * Root vitest config — runs adapter integration tests only.
 * Package-level unit tests (packages/sdk, packages/cli) use their own
 * per-package vitest invocations via `pnpm -r run test`.
 *
 * These tests hit live government websites via Playwright, so they are
 * intentionally slow and run in forked processes for isolation.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    // Point workspace packages at their TypeScript source so vitest can
    // compile them on the fly — no need to `pnpm build:testing` first.
    alias: {
      '@civic-mcp/sdk': resolve(import.meta.dirname, 'packages/sdk/src/index.ts'),
      '@civic-mcp/testing': resolve(import.meta.dirname, 'packages/testing/src/index.ts'),
    },
  },
  test: {
    include: ['adapters/**/*.test.ts'],
    // Each test can take up to 60 s (network + page load)
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // Forked processes keep Playwright browser instances isolated per suite
    pool: 'forks',
    reporter: 'verbose',
  },
});
