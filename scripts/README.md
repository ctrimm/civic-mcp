# scripts/

Node.js utility scripts for registry maintenance and CI validation. These are CommonJS files invoked directly — no build step required.

## update-registry.js

Scans all adapter directories and regenerates `registry/registry.json`.

```bash
node scripts/update-registry.js
# or via npm alias:
npm run registry:update
```

**What it does:**
1. Reads every `adapters/*/manifest.json`
2. Preserves existing `installs` and `rating` values from the current `registry.json`
3. Recounts plugins per category
4. Writes the updated file with a fresh `updatedAt` timestamp

Run this after adding, removing, or modifying any adapter.

---

## validate-manifest.js

Validates one or more adapter `manifest.json` files and exits non-zero if any fail.

```bash
node scripts/validate-manifest.js adapters/gov.colorado.peak/manifest.json
node scripts/validate-manifest.js adapters/*/manifest.json
```

**Checks performed:**
- Required fields present (`id`, `name`, `version`, `author`, `description`, `homepage`, `repository`, `license`)
- `id` matches reverse-DNS format (`gov.state.portal`)
- `version` is valid semver
- `domains` is a non-empty array
- `tools` is a non-empty array with valid `securityLevel` values
- `permissions.required` / `optional` use only allowed permission names
- `trustLevel` is `official`, `verified`, or `community`

This script is wired into lint-staged and runs automatically on every commit that touches an `adapters/*/manifest.json` file.
