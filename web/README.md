# weedspots.io web

Static Astro + Tailwind v4 rebuild of the weedspots.io directory.

## Prerequisites
- Node >= 22.12.0
- A BSON dump of the `weedspots` MongoDB database at `../exports/db-export/`

## Workflow
```bash
npm install
npm run import   # parse BSON + scrape og:image cover photos + write JSON
npm run dev      # astro dev server at http://localhost:4321
npm run build    # static output to dist/
npm test         # vitest
```

See `docs/superpowers/specs/2026-04-07-weedspots-astro-rebuild-design.md` for the full design.
