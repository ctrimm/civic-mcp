# @civic-mcp/testing

Playwright-backed test harness for civic-mcp adapters. Provides a `SandboxContext` that maps the adapter API to a real browser page, plus assertion helpers and fixture data.

## Install

Consumed as a workspace dependency — no separate install needed. Playwright browsers must be installed once:

```bash
pnpm exec playwright install chromium
```

## Usage in adapter tests

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { createHarness, matchers } from '@civic-mcp/testing';
import { resolve } from 'node:path';

expect.extend(matchers);

const harness = createHarness({
  adapterPath: resolve(import.meta.dirname, '../adapter.ts'),
  manifestPath: resolve(import.meta.dirname, '../manifest.json'),
});

afterAll(() => harness.close());

describe('check_eligibility', () => {
  it('returns a result', { timeout: 30_000 }, async () => {
    const result = await harness.testTool('check_eligibility', {
      householdSize: 3,
      monthlyIncome: 2500,
    });
    expect(result.success).toBe(true);
  });
});
```

## API

### `createHarness(options)`

Returns an `AdapterTestHarness` with a real Playwright browser backing the `SandboxContext`. The browser launches lazily on the first `testTool()` call.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `adapterPath` | `string` | ✅ | Absolute path to `adapter.ts` / `adapter.js` |
| `manifestPath` | `string` | ✅ | Absolute path to `manifest.json` |
| `headed` | `boolean` | — | Show the browser window (default: `false`) |
| `timeout` | `number` | — | Page operation timeout in ms (default: `15000`) |

### Matchers

```ts
expect(result).toBeToolSuccess()          // result.success === true
expect(result).toBeToolError('CODE')      // result.success === false, matches code
expect(result).toHaveToolData({ key })    // result.data contains key
```

### Fixtures

```ts
import { TEST_HOUSEHOLDS, TEST_PERSONS, TEST_ADDRESSES, eligibilityPayload } from '@civic-mcp/testing';

const payload = eligibilityPayload('CO', { householdSize: 3 });
```

Pre-built household, person, and address data for CO, CA, MI, and TX.

## Running adapter tests

```bash
# One-time: install the Playwright browser
pnpm exec playwright install chromium

# All adapters (from repo root)
pnpm test:adapters

# One adapter
pnpm exec vitest run adapters/gov.colorado.peak

# Headed mode (see the browser window)
CIVIC_MCP_HEADED=1 pnpm exec vitest run adapters/gov.colorado.peak
```

> **Live sites:** Tests run against real government websites — they require a live internet connection and may be slow. Authenticated tests (login required) are marked `.skip`; set the relevant `*_SESSION_COOKIE` env var to enable them.

## Development

```bash
cd packages/testing
pnpm build
pnpm dev        # watch mode
pnpm typecheck
```
