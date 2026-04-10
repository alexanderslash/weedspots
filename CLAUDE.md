# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Weedspots.io is a cannabis business directory site for New York State. It aggregates dispensary/smoke shop data from Google Places into MongoDB, then generates a static site using Astro.

## Repository Structure

The project lives under `exports/` with three main modules:

- **`exports/site/`** — Astro 6 static site generator (the main website). Reads from MongoDB at build time, outputs to `exports/dist/`.
- **`exports/builder/`** — Node.js build scripts (`build.js`, `helpers.js`) and HTML templates for an older/alternate build pipeline.
- **`exports/admin/`** — Express admin server (`server.js`) for managing businesses, running scrapes, and content operations. Runs on port defined by `ADMIN_PORT`.
- **`exports/db-export/`** — MongoDB dump files (BSON) for the `weedspots` database.

## Development Commands

All commands run from `exports/site/`:

```bash
npm run dev        # Start Astro dev server at localhost:4321
npm run build      # Build static site to exports/dist/ + minify CSS via postbuild.mjs
npm run preview    # Preview the built site locally
```

Requires Node.js >= 22.12.0.

To restore the database: `mongorestore --db weedspots exports/db-export/`

## Architecture

### Data Flow
MongoDB (`weedspots` database) → `src/lib/db.ts` (singleton cache via `getAllData()`) → Astro pages generate static HTML at build time.

### Key Files
- **`src/lib/db.ts`** — Mongoose connection, `Business` and `PlaceRaw` models (schemaless), `getAllData()` singleton that merges both collections and caches the result.
- **`src/lib/utils.ts`** — Shared constants (`CANNABIS_BROWSE_CATEGORIES`, `LISTINGS_PER_PAGE`), slug generators, sorting (`rankSort`), pagination, Schema.org JSON-LD helpers, and `effectiveCategory()` which resolves the most accurate cannabis category from Google's primary/additional categories.
- **`src/layouts/Layout.astro`** — Base layout with SEO meta, breadcrumbs, header nav, and footer. All pages use this.
- **`postbuild.mjs`** — Post-build step that minifies `src/styles/style.css` → `dist/assets/style.min.css` using CleanCSS.

### Routing (Astro file-based)
- `/` — Homepage with city grid and category browse
- `/listing/[slug]/` — Individual business detail page
- `/dispensaries/[city]/` — City listing page
- `/dispensaries/[city]/[category]/[...page]` — City + category with pagination
- `/category/` — Category index
- `/category/[category]/[...page]` — Category listing with pagination
- `/dispensaries/rating/[stars]/[...page]` — Filter by star rating
- `/top-rated/[city]` — Top-rated businesses in a city
- `/search/` — Client-side search (uses `/search-index.json`)
- `/sitemap-index.xml`, `/[sitemap].xml`, `/robots.txt` — SEO endpoints

### Business Ranking
Businesses sort by rating tier (5, 4.5, 4, 3.5, floor), then review count, then most recent review date. Sponsored businesses (`isSponsored` + `sponsoredUntil`) appear first, capped at 3.

### CSS
No CSS framework — single hand-written `src/styles/style.css` file. The build outputs a minified version. The layout references `/assets/style.min.css`.

### Environment Variables
- `MONGODB_URI` — MongoDB connection string (required for build)
- `SITE_URL` — Base URL, defaults to `https://weedspots.io`
- `ADMIN_PORT` / `ADMIN_TOKEN` — For the admin server
- `GOOGLE_API_KEYS` — Comma-separated Google Places API keys
- `ANTHROPIC_API_KEY` — Used by admin for AI-generated SEO content

## Important Patterns

- The Astro config uses `output: 'static'` and `trailingSlash: 'always'` — all URLs must end with `/`.
- Build output goes to `../dist` (relative to site dir), i.e. `exports/dist/`.
- Mongoose models use `strict: false` (schemaless) — the `BusinessDoc` interface in `db.ts` is the canonical type definition.
- `effectiveCategory()` is critical for categorization — it prefers `primaryGoogleCategory` if cannabis-relevant, then checks `additionalGoogleCategories`, then falls back to the scraped `category` field.
- The `CANNABIS_BROWSE_CATEGORIES` set controls which categories appear in browse/category pages. Businesses outside this set still appear in city pages, search, and listings.
