# registry/

The source-of-truth adapter registry for civic-mcp. The extension and the public website both read from these files.

## Files

| File | Purpose |
|------|---------|
| `registry.json` | Master list of all published adapters with metadata |
| `verified.json` | Approved verified publishers (Nava PBC, Code for America, USDS, etc.) |

## registry.json shape

```jsonc
{
  "version": "1.0",
  "updatedAt": "2026-02-17T00:00:00Z",
  "plugins": [
    {
      "id": "gov.colorado.peak",
      "name": "Colorado PEAK Benefits",
      "description": "…",
      "latestVersion": "0.1.0",
      "category": "state_benefits",
      "tags": ["SNAP", "Medicaid", "Colorado"],
      "trustLevel": "verified",   // official | verified | community
      "state": "CO",
      "installs": 0,
      "rating": 0,
      "updatedAt": "…",
      "manifestUrl": "…",
      "downloadUrl": "…"
    }
  ],
  "categories": [ /* id, name, count */ ]
}
```

## Updating the registry

After adding or changing an adapter, regenerate `registry.json` from the adapter manifests:

```bash
npm run registry:update
# equivalent: node scripts/update-registry.js
```

The script scans every `adapters/*/manifest.json`, merges existing `installs` / `rating` values, and rewrites `registry.json`.

## Adding a new adapter

1. Build the adapter under `adapters/your.adapter.id/`
2. Run `npm run registry:update`
3. Verify the entry appears correctly in `registry.json`
4. Open a PR — a maintainer will set `trustLevel` and `verified` before merging

## Verified publishers

`verified.json` is maintained by project maintainers. To apply for verified status, open an issue with your organization details and a link to your first adapter PR.
