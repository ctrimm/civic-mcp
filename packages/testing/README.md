# @civic-mcp/testing

Playwright-backed test harness for civic-mcp adapters. Provides a `SandboxContext` that maps the adapter API to a real browser page, plus assertion helpers and fixture data.

## Install

Consumed as a workspace dependency — no separate install needed. Playwright browsers must be installed once:

```bash
npx playwright install chromium
```

## Usage in adapter tests

```ts
import { test, expect } from 'vitest';
import { createHarness } from '@civic-mcp/testing';

test('check_eligibility returns a result', async () => {
  const harness = await createHarness();

  const result = await harness.runTool('check_eligibility', {
    householdSize: 3,
    monthlyIncome: 2500,
  });

  expect(result).toBeToolSuccess();
  harness.close();
});
```

## API

### `createHarness(options?)`

Returns an `AdapterTestHarness` with a real Playwright browser backing the `SandboxContext`.

| Option | Default | Description |
|--------|---------|-------------|
| `headless` | `true` | Run browser headlessly |
| `baseURL` | — | Base URL for relative navigations |

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
# From an adapter directory:
civic-mcp test

# Or directly:
cd adapters/gov.colorado.peak
npx vitest run

# From the repo root (all adapters):
npm test
```

> **Live sites:** Tests run against real government websites — they require a live internet connection and may be slow. Authenticated tests (login required) are marked `.skip` and tagged `@authenticated`.

## Development

```bash
cd packages/testing
npm run build
npm run dev        # watch mode
npm run typecheck
```
