# @civic-mcp/sdk

Shared TypeScript types and utilities used by adapters, the extension, the CLI, and the testing harness. All other packages in this monorepo depend on this one.

## Install

This package is consumed internally via the monorepo workspace — no separate installation needed.

```bash
# From the repo root
npm install
```

## Development

```bash
cd packages/sdk
npm run dev        # watch mode (tsc --watch)
npm run build      # compile to dist/
npm run typecheck  # type-check without emitting
npm run test       # vitest
```

## What's inside

| Path | Purpose |
|------|---------|
| `src/types/manifest.ts` | `AdapterManifest`, `TrustLevel`, `AdapterPermissions` |
| `src/types/adapter.ts` | `AdapterModule`, `AdapterTool`, `ToolResult` |
| `src/types/sandbox.ts` | `SandboxContext`, `PageAPI`, `StorageAPI`, `NotifyAPI` |
| `src/types/declarative.ts` | `DeclarativeTool`, `NavigationDef`, `InputDef` |
| `src/types/registry.ts` | `RegistryEntry`, `RegistryIndex`, `VerifiedPublisher` |
| `src/utils/validate-manifest.ts` | `validateManifest(raw)` — returns `ValidationResult` |
| `src/utils/selector-helpers.ts` | `isUrlAllowed`, `namespacedToolName`, `pluginStorageKey`, `sanitizeFieldValue` |

## Usage in adapters

```ts
import type { AdapterModule, SandboxContext, ToolResult } from '@civic-mcp/sdk';
import { isUrlAllowed } from '@civic-mcp/sdk';

const adapter: AdapterModule = {
  tools: [{
    name: 'check_eligibility',
    description: 'Check SNAP eligibility',
    inputSchema: { /* … */ },
    async execute(params, context: SandboxContext): Promise<ToolResult> {
      await context.page.navigate('https://portal.state.gov/check');
      // …
      return { success: true, data: { eligible: true } };
    },
  }],
};

export default adapter;
```
