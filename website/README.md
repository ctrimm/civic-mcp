# @civic-mcp/website

Public adapter discovery site — a static Astro site that reads `registry/registry.json` at build time and renders a searchable, filterable adapter catalogue.

## Get started

```bash
# From the repo root:
npm run dev:website          # http://localhost:4321

# Or from this directory:
cd website
npm run dev
npm run build                # → dist/  (static, deploy anywhere)
npm run preview              # serve the built dist/ locally
```

## Stack

- **[Astro](https://astro.build)** — zero-JS by default, static output
- **Registry data** — imported directly from `registry/registry.json` at build time (no runtime fetch)
- **Styling** — inline styles + CSS variables; cyan accent (`#06b6d4`) matching the CLI brand

## Updating the site

The site rebuilds from the registry on every `npm run build`. To reflect new or updated adapters:

```bash
npm run registry:update   # regenerate registry/registry.json from adapter manifests
npm run build:website     # rebuild the site
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
