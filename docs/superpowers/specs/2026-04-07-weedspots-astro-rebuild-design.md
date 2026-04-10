# Weedspots.io — Astro + Tailwind v4 Rebuild

**Date:** 2026-04-07
**Status:** Approved design, ready for implementation planning
**Scope:** Full ground-up rebuild of the weedspots.io static directory site

---

## 1. Context & goal

Weedspots.io is a static directory of cannabis businesses (dispensaries, smoke shops, delivery services, and adjacent categories) currently focused on New York State, with plans to expand to other U.S. states and other countries. A prior collaborator built three generations of the site (`exports/builder/`, `exports/site/`, `exports/admin/`) backed by MongoDB, with data sourced from the Google Places API.

This project is a **complete fresh rebuild**, not a port. It discards the existing CSS and HTML/Handlebars templates entirely, keeps the business logic insights from the prior work as reference, and replaces the MongoDB dependency with a flat-file JSON data pipeline.

**Goals:**

1. Produce a fully static, fast, SEO-optimized directory site using Astro and Tailwind v4.
2. Remove the runtime MongoDB dependency. Data lives in JSON files generated at import time from the existing BSON dump.
3. Make it trivial to refresh the dataset when new businesses are scraped: drop a new BSON dump in place, run one command, rebuild.
4. Design URL structure to support future expansion to other states and countries without breaking SEO.
5. Ship a clean, modern visual design that doesn't look like a generic directory template.

**Non-goals for v1:** any form of admin UI, an active scraper, user accounts, reviews, interactive maps, filtering UI, i18n, a CMS, a blog, a cookie consent banner, or a newsletter.

---

## 2. Source data (what we already have)

The `exports/db-export/` folder contains a MongoDB dump with five collections. Only two are load-bearing for the site:

- **`businesses.bson`** (24 MB) — enriched business records. Indexed on `placeId`, `slug`, `city`, `state`, `category`, `rating`, `scrapedAt`. One document per business. Field shape documented in `exports/site/src/lib/db.ts` (`BusinessDoc` interface). Key fields: `placeId`, `name`, `slug`, `category`, `primaryGoogleCategory`, `additionalGoogleCategories[]`, `formattedAddress`, `street`, `city`, `county`, `state`, `postalCode`, `lat`, `lng`, `phone`, `website`, `googleMapsUri`, `rating`, `reviewCount`, `reviews[]`, `photos[]`, `openingHours`, `businessStatus`, `isSponsored`, `sponsoredUntil`, `scrapedAt`, `createdAt`.
- **`placeraws.bson`** (45 MB) — raw Google Places API responses keyed by `placeId`. Source of truth for `editorialSummary`, `parkingOptions`, `accessibilityOptions`, `paymentOptions`.

The other three collections (`scrapequeues`, `scraperuns`, `placeblocklists`) are scraper-side state and are not read by this project.

**Photos:** the `photos[]` array on each business only contains photo references (e.g. `places/ChIJ.../photos/AelYt5...`), not image bytes. To display a real photo we must call the Google Places Photo API v1 with the reference and a Google API key.

**Stale references warning:** photo refs are stable for approximately 12 months. The current dump is from 2026-04-06, so photo fetches may have some failure rate. Failures fall back to gradient placeholders.

---

## 3. Architecture overview

```
exports/db-export/*.bson
         │
         │  npm run import              (web/scripts/import.mjs)
         │  - parses BSON via `bson`
         │  - merges businesses + placeraws
         │  - applies effectiveCategory()
         │  - fetches cover photos from Google Places API
         │  - writes data JSON + search index
         ▼
web/src/data/*.json         web/public/images/*.webp     web/public/search-index.json
         │
         │  npm run build               (astro build)
         │  - getAllData() singleton loads all JSON once
         │  - builds ~5,000 static pages
         ▼
web/dist/   (fully static HTML, CSS, images, XML sitemaps)
         │
         ▼
      weedspots.io
```

**Three commands, three stages.** No MongoDB server, no runtime database, no SSR, no hydration, no API routes.

### 3.1 Stack

- **Astro 6** with `output: 'static'`, `trailingSlash: 'always'`, file-based routing, `outDir: './dist'`
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.js`, no PostCSS, single CSS file with `@theme` directive)
- **TypeScript** throughout
- **`bson` npm package** — parses BSON files directly without a MongoDB instance
- **`sharp`** — image resize / WebP encoding in the import script
- **`p-limit`** — concurrency cap for photo downloads
- **`@fontsource-variable/inter`** — self-hosted Inter typeface
- **Node ≥ 22.12.0**
- **Zero React, zero shadcn, zero UI frameworks.** All components are `.astro`. The only JavaScript that runs in the browser is the ~3 KB vanilla search script on `/search/` and the Google Analytics gtag snippet on every page.

### 3.2 Folder layout

```
weedspots/
├── docs/
│   └── superpowers/specs/
│       └── 2026-04-07-weedspots-astro-rebuild-design.md   # this file
│
├── exports/                      # Untouched reference material
│   ├── admin/ builder/ site/     # Prior collaborator's work
│   └── db-export/                # BSON dump (default BSON_DUMP_DIR)
│
├── web/                          # The new project
│   ├── astro.config.mjs
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── .gitignore
│   ├── README.md
│   │
│   ├── scripts/
│   │   └── import.mjs            # BSON → JSON import CLI
│   │
│   ├── src/
│   │   ├── data/                 # Generated by import script
│   │   │   ├── businesses.json
│   │   │   ├── cities.json
│   │   │   └── categories.json
│   │   │
│   │   ├── data-static/          # Hand-edited, committed
│   │   │   └── sponsors.json
│   │   │
│   │   ├── lib/
│   │   │   ├── data.ts           # getAllData() singleton
│   │   │   ├── slugs.ts          # citySlug, stateCitySlug, categorySlug, reserved-word guard
│   │   │   ├── ranking.ts        # rankSort, tiers, sponsored float
│   │   │   ├── schema-org.ts     # JSON-LD generators
│   │   │   └── constants.ts      # CANNABIS_BROWSE_CATEGORIES, LISTINGS_PER_PAGE
│   │   │
│   │   ├── styles/
│   │   │   └── global.css        # @import "tailwindcss" + @theme tokens
│   │   │
│   │   ├── components/
│   │   │   ├── Layout.astro
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   ├── Breadcrumbs.astro
│   │   │   ├── BusinessCard.astro
│   │   │   ├── BusinessGrid.astro
│   │   │   ├── CategoryPill.astro
│   │   │   ├── CityTile.astro
│   │   │   ├── Rating.astro
│   │   │   ├── Pagination.astro
│   │   │   ├── SearchBox.astro
│   │   │   ├── GoogleAnalytics.astro
│   │   │   └── SchemaJsonLd.astro
│   │   │
│   │   └── pages/                # See section 5
│   │
│   └── public/
│       ├── favicon.ico
│       ├── logo.svg
│       ├── og-default.jpg
│       ├── images/               # Committed, generated by import
│       └── search-index.json     # Committed, generated by import
│
└── .superpowers/                 # Visual companion mockups (gitignored)
```

**Why this shape:**

- `web/` is isolated. `exports/` is untouched reference material.
- `src/data/` (generated) vs `src/data-static/` (hand-edited) is a clear split: generated can be wiped and rebuilt, static is human-owned.
- `src/lib/` files are small and single-purpose.
- Everything in `web/public/images/` and `web/src/data/` is committed to git per decision (section 3.4).

### 3.3 Configuration (env vars)

```
# web/.env (gitignored; .env.example committed)
BSON_DUMP_DIR=../exports/db-export         # optional, default shown
GOOGLE_API_KEY=AIza...                     # required for photo prefetch
GOOGLE_API_KEYS=key1,key2,key3             # optional, rotates on rate-limit
SITE_URL=https://weedspots.io              # used for canonical URLs + sitemaps
GA_MEASUREMENT_ID=G-XXXXXXXXXX             # optional, enables GA4
GSC_VERIFICATION=XXXXXXXXXXXXXXXXXX        # optional, enables Google Search Console meta tag
```

Import script requires `GOOGLE_API_KEY` (or `GOOGLE_API_KEYS`). Build requires only `SITE_URL`. Dev server requires nothing.

### 3.4 Git policy

**Commit everything.** The `exports/db-export/*.bson` files, `web/public/images/*.webp`, `web/src/data/*.json`, and `web/public/search-index.json` all live in git. Total expected repo size is approximately 120 MB.

Rationale:
- Fresh clones work instantly without any external setup.
- CI/CD does not need Google API key secrets — only the one-off import needs them.
- The dataset changes infrequently (only when new scrapes happen), so commit churn is low.
- The BSON dump is the source of truth; images and JSON are derived artifacts but committed to keep the pipeline self-contained.

Only `web/.env`, `web/node_modules/`, `web/dist/`, `web/.astro/`, and `.superpowers/` are gitignored.

---

## 4. Data pipeline: `npm run import`

File: `web/scripts/import.mjs` (ES module, no TypeScript).

### 4.1 Pipeline stages, in order

1. **Parse env** — read `BSON_DUMP_DIR` (default `../exports/db-export`), `GOOGLE_API_KEY` / `GOOGLE_API_KEYS`. Exit with a clear error if no API key present.
2. **Parse BSON files** — use the `bson` npm package to read `businesses.bson` and `placeraws.bson` into arrays of JS objects. No MongoDB connection.
3. **Filter businesses** — keep only `businessStatus === 'OPERATIONAL'`. Log the drop count.
4. **Merge placeraws** — index `placeraws` by `placeId`, then for each business attach:
   - `editorialSummary` ← `placeRaw.data.editorialSummary?.text`
   - `parkingOptions` ← `placeRaw.data.parkingOptions ?? {}`
   - `accessibilityOptions` ← `placeRaw.data.accessibilityOptions ?? {}`
   - `paymentOptions` ← `placeRaw.data.paymentOptions ?? {}`
5. **Compute derived fields** per business:
   - `category` ← `effectiveCategory(b)` — matches logic in `exports/site/src/lib/utils.ts`
   - `stateCitySlug` ← `${state.toLowerCase()}-${citySlug(city)}` with reserved-word guard. Businesses with no state OR no city are kept but get `stateCitySlug: null` and do not appear in city/city+category pages.

   The gradient-fallback color is **not** precomputed at import time. It is derived at render time by hashing `placeId` inside `BusinessCard.astro` (section 6.4). Nothing needs to live in `businesses.json` for this.
6. **Photo prefetch** — for each business with at least one photo reference:
   - Target file: `web/public/images/${placeId}.webp`
   - If file exists on disk → skip (idempotent, resumable)
   - Otherwise: `GET https://places.googleapis.com/v1/${photos[0].name}/media?maxHeightPx=600&maxWidthPx=800&key=${apiKey}`
   - Pipe response bytes through `sharp`: resize max 800×600 preserving aspect, encode WebP q=80, write to target file
   - Set `coverPhoto: "/images/${placeId}.webp"` on the business record
   - **On failure** (HTTP error, rate limit, network, sharp error): log `[warn] photo ${placeId}: ${err.message}`, set `coverPhoto: null`, continue. **Never abort the whole import.**
   - Concurrency: `p-limit(8)` — 8 parallel downloads max
   - Progress: log every 100 completions
   - If `GOOGLE_API_KEYS` is a comma-separated list, rotate on rate-limit failures (HTTP 429) and retry once per key before giving up on a photo
7. **Sort businesses** once via `rankSort` (rating tier → review count → newest review date). This becomes the canonical order for all downstream consumers.
8. **Build aggregates:**
   - `cities`: `Array<{ stateCitySlug, cityName, state, count, categoryCounts: Record<string, number> }>` — one entry per distinct `stateCitySlug`
   - `categories`: `Array<{ slug, display, count }>` — only categories in `CANNABIS_BROWSE_CATEGORIES`
9. **Write outputs** (all pretty-printed JSON — diffable in git):
   - `web/src/data/businesses.json`
   - `web/src/data/cities.json`
   - `web/src/data/categories.json`
   - `web/public/search-index.json` — trimmed: `Array<{ slug, name, stateCitySlug, city, state, category, rating }>`
10. **Print summary:**
    ```
    ✓ Imported 4,812 businesses (47 dropped — not OPERATIONAL)
    ✓ Downloaded 3,921 cover photos (891 with no source photo; 0 failed)
    ✓ Aggregated 84 cities, 14 cannabis categories
    ✓ Total build data: 28.4 MB JSON, 47.2 MB images
    ```

### 4.2 Refresh workflow (future scrapes)

1. Get a new BSON dump from the scraper (yours or collaborator's).
2. Replace files in `exports/db-export/` (or point `BSON_DUMP_DIR` elsewhere).
3. `cd web && npm run import`
4. `npm run build`
5. Commit and deploy.

The import script is idempotent on photos: already-downloaded files are skipped. If you want to force re-download photos, delete `web/public/images/` first.

---

## 5. Routing & page structure

All URLs end with `/` per `trailingSlash: 'always'`.

### 5.1 Page inventory

| # | Page type | URL pattern | Astro route file | Pages produced |
|---|---|---|---|---|
| 1 | Homepage | `/` | `pages/index.astro` | 1 |
| 2 | Listing detail | `/listing/[slug]/` | `pages/listing/[slug].astro` | ~4,800 |
| 3 | City page | `/[stateCity]/` | `pages/[stateCity]/index.astro` | ~84 |
| 4 | City + category | `/[stateCity]/[category]/` + pagination | `pages/[stateCity]/[category]/[...page].astro` | one per (city, category, page) with ≥ 3 listings |
| 5 | Top-10 per city | `/[stateCity]/top-rated/` | `pages/[stateCity]/top-rated.astro` | ~84 |
| 6 | Category index | `/category/` | `pages/category/index.astro` | 1 |
| 7 | Category page | `/category/[category]/` + pagination | `pages/category/[category]/[...page].astro` | one per (category, page) |
| 8 | Rating filter | `/rating/[stars]/` + pagination | `pages/rating/[stars]/[...page].astro` | `stars ∈ {4-star, 5-star}`, paginated |
| 9 | Search | `/search/` | `pages/search/index.astro` | 1 |
| — | Sitemap index | `/sitemap-index.xml` | `pages/sitemap-index.xml.ts` | 1 |
| — | Sitemaps | `/sitemap-{kind}.xml` | `pages/sitemap-[kind].xml.ts` | ~6 |
| — | Robots | `/robots.txt` | `pages/robots.txt.ts` | 1 |

**Total expected pages at v1 scale:** roughly 5,200 HTML pages plus ~8 XML sitemaps.

### 5.2 URL collision handling

City slugs are always `<state>-<city>` (2-letter state code prefix), so collisions with reserved root segments are structurally impossible for valid data. Astro's route resolution also prefers specific static routes over dynamic catch-alls, so `/category/` resolves to `pages/category/index.astro` before trying `pages/[stateCity]/index.astro`.

A safety guard lives in `src/lib/slugs.ts`:

```ts
const RESERVED_ROOT = new Set([
  'listing', 'category', 'rating', 'search',
  'sitemap-index.xml', 'robots.txt', 'favicon.ico',
  'assets', 'images', '_astro', 'api',
]);

export function stateCitySlug(state: string, city: string): string {
  const slug = `${state.toLowerCase().trim()}-${citySlug(city)}`;
  if (RESERVED_ROOT.has(slug)) {
    throw new Error(`Reserved slug collision: ${slug}`);
  }
  return slug;
}
```

### 5.3 Pagination

- `LISTINGS_PER_PAGE = 20` (matches prior site)
- Route pattern: `[...page].astro` — rest param is either empty (page 1) or `page/2/`, `page/3/`, etc.
- Page 1 canonical URL: `/category/dispensary/`
- Page 2+ canonical URL: `/category/dispensary/page/2/`
- Pagination navigation renders prev/next + numbered page links (`src/components/Pagination.astro`)

### 5.4 Data access pattern

Every page reads from a single `getAllData()` singleton in `src/lib/data.ts`:

```ts
import { getAllData } from '../lib/data';

export async function getStaticPaths() {
  const { cities } = await getAllData();
  return cities.map(c => ({
    params: { stateCity: c.stateCitySlug },
    props: { city: c },
  }));
}
```

`getAllData()` reads the three JSON files once, merges `sponsors.json` (setting `isSponsored` and `sponsoredUntil` on matching `placeId`s), caches the result in module-level state, and returns it to every subsequent caller. All ~5,000 page builds read from one in-memory object.

---

## 6. Visual system

Direction chosen: **Modern Marketplace** (option B in brainstorming). Light background, white rounded cards with soft shadows, green accents, friendly spacing. Airbnb/Yelp-adjacent vibe.

### 6.1 Tailwind v4 setup

No `tailwind.config.js`. No PostCSS. One CSS file, one Vite plugin.

`web/astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  outDir: './dist',
  build: { format: 'directory' },
  vite: { plugins: [tailwindcss()] },
});
```

`web/src/styles/global.css`:

```css
@import "tailwindcss";

@theme {
  /* Brand */
  --color-brand-50:  #f1fdf4;
  --color-brand-100: #defbe6;
  --color-brand-200: #b6f4c6;
  --color-brand-300: #7fe79b;
  --color-brand-400: #3ecf6b;
  --color-brand-500: #16b84b;   /* primary */
  --color-brand-600: #0e9a3c;
  --color-brand-700: #0d7b32;
  --color-brand-800: #0f622c;
  --color-brand-900: #0f5027;

  /* Warm-gray neutrals */
  --color-ink-50:  #fafaf9;
  --color-ink-100: #f5f5f4;
  --color-ink-200: #e7e5e4;
  --color-ink-300: #d6d3d1;
  --color-ink-400: #a8a29e;
  --color-ink-500: #78716c;
  --color-ink-600: #57534e;
  --color-ink-700: #44403c;
  --color-ink-800: #292524;
  --color-ink-900: #1c1917;

  /* Accent */
  --color-gold-500: #f5a623;   /* rating stars */

  /* Typography */
  --font-sans: "Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Inter Variable", "Inter", system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", monospace;

  /* Radius */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;        /* cards */
  --radius-xl: 1.5rem;      /* hero panels */
  --radius-full: 9999px;    /* pills */

  /* Shadow */
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.04), 0 4px 12px rgb(0 0 0 / 0.05);
  --shadow-card-hover: 0 2px 4px rgb(0 0 0 / 0.06), 0 12px 24px rgb(0 0 0 / 0.08);
}

html { font-family: var(--font-sans); color: var(--color-ink-800); background: var(--color-ink-50); }
body { -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: none; }
a:hover { color: var(--color-brand-600); }
```

Inter is imported once in `Layout.astro`:

```astro
---
import '@fontsource-variable/inter';
import '../styles/global.css';
---
```

### 6.2 Typography scale

| Element | Tailwind classes |
|---|---|
| Page H1 (hero) | `text-4xl md:text-5xl font-semibold tracking-tight` |
| Section H2 | `text-2xl md:text-3xl font-semibold tracking-tight` |
| Card title | `text-base font-semibold` |
| Card meta | `text-sm text-ink-600` |
| Small label | `text-xs uppercase tracking-wider text-ink-500` |
| Body | `text-base leading-relaxed text-ink-700` |

### 6.3 Container

```astro
<div class="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
```

`max-w-6xl` = 1152px. Used on every page for consistent gutters.

### 6.4 `BusinessCard` spec

The single most repeated component on the site.

```
┌──────────────────────────────┐
│                              │  ← cover: aspect-[4/3], object-cover,
│     [cover photo or          │     rounded-t-lg, w-full
│      gradient fallback]      │
│                           [●]│  ← open/closed badge, absolute top-right
├──────────────────────────────┤
│ The Cannabis Place           │  ← text-base font-semibold text-ink-900
│ Dispensary · Albany, NY      │  ← text-sm text-ink-600 mt-0.5
│                              │
│ ★ 4.8  (217 reviews)         │  ← gold star, rating bold, count muted
└──────────────────────────────┘
   rounded-lg shadow-card bg-white
   hover:shadow-card-hover transition
   border border-ink-100
```

**Gradient fallback** when `coverPhoto === null`:

```ts
function gradientFor(placeId: string): string {
  const hash = [...placeId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const h = 80 + (hash % 80);   // 80..160, green/leafy range
  return `linear-gradient(135deg, hsl(${h}, 60%, 88%), hsl(${h}, 50%, 72%))`;
}
```

The same visual weight as a real photo — no "broken image" look.

### 6.5 Other component specs

- **`Header.astro`** — logo (left), nav links to `/category/`, `/search/`, and 3-4 featured cities, plus a compact search box (right). Mobile: hamburger toggle using a small inline script.
- **`Footer.astro`** — four-column grid with brand, popular cities, categories, resources (search, sitemap). Single copyright line at the bottom.
- **`Breadcrumbs.astro`** — accessible `<nav>` with `<ol>` and Schema.org microdata. Renders only if `breadcrumbs.length > 0`.
- **`Rating.astro`** — accepts `value` (number) and `count` (number). Renders inline SVG star + numeric rating + review count.
- **`Pagination.astro`** — prev / numbered pages / next. Renders nothing if `totalPages <= 1`.
- **`SearchBox.astro`** — input + dropdown results. Vanilla JS, loads `search-index.json` on first focus, substring search, 50 results cap. Used both on `/search/` and in the header.
- **`GoogleAnalytics.astro`** — renders gtag snippet only if `GA_MEASUREMENT_ID` is set in `import.meta.env`.
- **`SchemaJsonLd.astro`** — accepts a single JSON-LD object or array and renders `<script type="application/ld+json">`.

---

## 7. Cross-cutting concerns

### 7.1 Sponsored listings

`web/src/data-static/sponsors.json` — committed, hand-edited:

```json
{
  "ChIJN1t_tDeuEmsRUsoyG83frY4": { "until": "2026-12-31" },
  "ChIJK7e3MqeuEmsRLbZk1wC4n3o": { "until": "2026-06-30" }
}
```

`getAllData()` reads this at build time and sets `isSponsored: true` plus `sponsoredUntil: Date` on matching businesses. Expired sponsors are ignored.

Rules:
- Up to **3 sponsored listings** float to the top of any listing-list page (city, category, city+category). Non-sponsored listings follow, sorted by `rankSort`.
- Sponsored cards get a `Sponsored` badge: `text-xs uppercase tracking-wider text-ink-500 bg-ink-100 rounded-full px-2 py-0.5`.
- Top-10 and rating filter pages ignore sponsorship entirely (pure rating-based ordering).
- Listing detail pages look identical whether sponsored or not.
- No sponsorship signal in sitemaps or Schema.org output.

### 7.2 Client-side search

- Source: `web/public/search-index.json` — generated by import, shape `Array<{ slug, name, stateCitySlug, city, state, category, rating }>`.
- `SearchBox.astro` loads it on first focus (lazy), caches in memory.
- Case-insensitive substring match across `name + city + category`.
- Results cap: 50.
- No fuzzy search library in v1. If the index grows past ~5 MB we can swap in `minisearch` (~8 KB gzipped) as a v2 upgrade without changing the file shape.
- Available in two places: `/search/` (full page) and header bar (redirects to `/search/?q=...`).

### 7.3 Sitemaps & SEO

| File | Contents |
|---|---|
| `sitemap-index.xml` | Links to all other sitemap files |
| `sitemap-homepage.xml` | `/` |
| `sitemap-cities.xml` | One URL per city page + each city's top-rated page + each city+category page |
| `sitemap-categories.xml` | `/category/` + each category page (with pagination) |
| `sitemap-listings-{n}.xml` | One URL per listing, split at 5,000 URLs per file |
| `sitemap-rating.xml` | `/rating/4-star/`, `/rating/5-star/` + pagination |

`robots.txt`: `User-agent: *`, `Allow: /`, `Sitemap: ${SITE_URL}/sitemap-index.xml`. No `Disallow`.

`Layout.astro` renders per-page SEO primitives:
- `<title>`, `<meta name="description">`, `<link rel="canonical">`, `<link rel="alternate" hreflang="en-US">`
- Open Graph: `og:title`, `og:description`, `og:image` (default `/og-default.jpg`, overridable), `og:type`, `og:url`, `og:site_name`
- `<meta name="robots" content="index, follow">`
- Schema.org JSON-LD injected via `SchemaJsonLd.astro`: `BreadcrumbList` on every page, `LocalBusiness` on listing pages, `ItemList` on top-rated pages, `FAQPage` when FAQs exist
- `<meta name="google-site-verification">` if `GSC_VERIFICATION` env var is set

### 7.4 Google Analytics 4

- Env var: `GA_MEASUREMENT_ID=G-XXXXXXXXXX`
- `GoogleAnalytics.astro` component renders the standard GA4 gtag snippet (async script + inline init) only if the env var is set
- Included once in `Layout.astro` just before `</head>`
- **No cookie consent banner in v1** — accepted risk per decision
- Dev builds (no env var) skip GA entirely

### 7.5 Performance budget

| Metric | Target |
|---|---|
| HTML per listing page (gzipped) | < 40 KB |
| CSS total (gzipped) | < 15 KB |
| JS on every page | ~45 KB (gtag only) |
| JS on `/search/` | ~48 KB (gtag + search script) |
| Hydration | None |
| LCP on listing detail page | < 1.5 s |
| Client-side routing | None (full page navigation) |

---

## 8. Key logic reference

These helpers are reimplemented in `web/src/lib/` — the prior project's versions in `exports/site/src/lib/utils.ts` are the reference.

### 8.1 `effectiveCategory(business)`

```
1. If primaryGoogleCategory is in CANNABIS_BROWSE_CATEGORIES → use it
2. Else if any additionalGoogleCategories entry is in CANNABIS_BROWSE_CATEGORIES → use first match
3. Else → fall back to business.category or 'Other'
```

### 8.2 `rankSort(a, b)`

```
1. rating tier (5, 4.5, 4, 3.5, floor) — higher first
2. reviewCount — higher first
3. newestReviewTs — more recent first
```

Tier boundaries: `>= 4.9` → 5; `>= 4.4` → 4.5; `>= 3.9` → 4; `>= 3.4` → 3.5; else `floor(rating)`.

### 8.3 `CANNABIS_BROWSE_CATEGORIES`

```ts
new Set([
  'cannabis store', 'cannabis club', 'smoke shop', 'tobacco shop',
  'vaporizer store', 'cigar shop', 'hookah store', 'hookah bar',
  'herbal medicine store', 'herb shop', 'grow shop', 'smart shop',
  'dispensary', 'hemp store', 'delivery service', 'store',
])
```

### 8.4 `citySlug(name)`

Lowercase, strip non-alphanumeric except spaces and hyphens, collapse whitespace to single hyphen, collapse repeated hyphens, trim leading/trailing hyphens.

### 8.5 `stateCitySlug(state, city)`

`${state.toLowerCase().trim()}-${citySlug(city)}`, guarded against `RESERVED_ROOT`.

### 8.6 `categorySlug(label)`

Same as `citySlug` plus replace `&` with ` and `.

---

## 9. Out of scope for v1

Calling out deliberately-deferred work so scope doesn't creep:

- **No admin UI.** `sponsors.json` is hand-edited; `npm run import` is a CLI.
- **No active scraper** in `web/`. Scraping happens elsewhere and produces BSON.
- **No authentication, accounts, reviews, or "claim your business".**
- **No photo carousel** on listing detail pages. One cover photo per business, even though source data may have 10+ refs.
- **No map view.** No Leaflet, no Mapbox, no Google Maps embed. Listing pages link out to Google Maps.
- **No filtering UI** on listing pages. Pagination + `rankSort` only.
- **No i18n.** Single locale `en-US`.
- **No CMS-managed content** (no blog, no about, no editorial).
- **No newsletter, contact form, lead capture, RSS, AMP.**
- **No cookie consent banner** (accepted risk per decision).

---

## 10. Open risks

1. **Stale photo references.** Current dump is from 2026-04-06. Photo refs last ~12 months. First import may have noticeable photo-fetch failure rate. Mitigation: gradient fallback is visually equivalent.
2. **`placeId` can change.** Rare, but Google occasionally merges/splits places. A new scrape giving a different `placeId` for the "same" business breaks the old URL. No automatic slug-alias redirect in v1.
3. **Category data is messy.** `category`, `primaryGoogleCategory`, and `additionalGoogleCategories` disagree often. Expect 5-10% of listings to land in a category that feels off.
4. **Pagination drift.** When the dataset changes, pagination URLs shift and Google re-crawls everything. Unavoidable with sorted-paginated static lists; low practical impact.
5. **Tailwind v4 edge cases.** v4 is production-quality as of 2025 but occasionally surfaces quirks. Pin to a specific v4.x version if anything bites.
6. **Repo size.** Committing BSON + images + JSON puts the repo around 120 MB. Cloning is slower, but each subsequent operation is fine. Not big enough to warrant Git LFS.

---

## 11. Summary of decisions

| Decision | Value |
|---|---|
| Project type | Fresh rebuild, not a port |
| Location | `./web/` at repo root |
| Framework | Astro 6 static, `trailingSlash: 'always'` |
| Styling | Tailwind v4, single `global.css` with `@theme` tokens |
| Components | All `.astro`, zero React, zero shadcn |
| Data source | BSON → JSON at import time, no database |
| Import script | `web/scripts/import.mjs`, reads BSON via `bson` package |
| BSON source | `BSON_DUMP_DIR=../exports/db-export` (env var) |
| Photos | Pre-fetched via Google Places Photo API v1 |
| Photo format | 800×600 max, WebP q=80, `sharp` + `p-limit(8)` |
| Photo fallback | Deterministic green-hue gradient from `placeId` hash |
| Git policy | Commit everything (BSON + images + JSON + sitemaps) |
| URL structure | Flat root: `/ny-albany/`, `/ny-albany/dispensary/`, `/ny-albany/top-rated/` |
| Listing URLs | `/listing/[slug]/` |
| Reserved roots | `listing`, `category`, `rating`, `search`, `sitemap-*`, etc. |
| Pagination | `LISTINGS_PER_PAGE=20`, rest-param route |
| Visual direction | Modern Marketplace (light, rounded cards, soft shadows) |
| Brand color | `#16b84b` |
| Typography | Inter (self-hosted via `@fontsource-variable/inter`) |
| Container | `max-w-6xl` (1152 px) |
| Page types | All 9 + sitemaps + robots |
| Search | Client-side vanilla JS, case-insensitive substring, 50 results cap |
| Sponsored | `sponsors.json` hand-edited, 3 max per page, listing pages only |
| Schema.org | `LocalBusiness`, `ItemList`, `BreadcrumbList`, `FAQPage` |
| Analytics | Google Analytics 4 via `GA_MEASUREMENT_ID`, no cookie banner |
| Search Console | `GSC_VERIFICATION` env var → meta tag |
| Node version | ≥ 22.12.0 |
