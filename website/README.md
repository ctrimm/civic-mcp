# @civic-mcp/website

Public adapter discovery site — a static Astro site that reads `registry/registry.json` at build time and renders a searchable, filterable adapter catalogue.

## Get started

```bash
# From the repo root:
pnpm dev:website          # http://localhost:4321

# Or from this directory:
cd website
pnpm dev
pnpm build                # → dist/  (static, deploy anywhere)
pnpm preview              # serve the built dist/ locally
```

## Stack

- **[Astro](https://astro.build)** — zero-JS by default, static output
- **Registry data** — imported directly from `registry/registry.json` at build time (no runtime fetch)
- **Styling** — inline styles + CSS variables; cyan accent (`#06b6d4`) matching the CLI brand

## Updating the site

The site rebuilds from the registry on every `pnpm build`. To reflect new or updated adapters:

```bash
pnpm registry:update   # regenerate registry/registry.json from adapter manifests
pnpm build:website     # rebuild the site
```

## Deployment

The `dist/` output is fully static — drop it on GitHub Pages, Netlify, Vercel, or any CDN.

```bash
# Example: GitHub Pages via gh-pages
npx gh-pages -d website/dist
```

## Structure

```
website/
├── src/
│   ├── pages/
│   │   └── index.astro     # Search + filter UI; reads registry.json
│   └── layouts/
│       └── Base.astro      # <html> shell, meta tags, global styles
├── public/
│   └── favicon.svg
├── astro.config.mjs
└── package.json
```
