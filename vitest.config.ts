/**
 * Root vitest config — runs adapter integration tests only.
 * Package-level unit tests (packages/sdk, packages/cli) use their own
 * per-package vitest invocations via `pnpm -r run test`.
 *
 * These tests hit live government websites via Playwright, so they are
 * intentionally slow and run in forked processes for isolation.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['adapters/**/*.test.ts'],
    // Each test can take up to 60 s (network + page load)
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // Forked processes keep Playwright browser instances isolated per suite
    pool: 'forks',
    poolOptions: {
      forks: {
        // Run one adapter at a time to avoid hammering live sites in parallel
        singleFork: false,
        maxForks: 2,
      },
    },
    reporter: 'verbose',
  },
});
