// Cannabis category allowlist — only these appear in Browse by Category pages.
// Businesses outside this list still appear in city pages, search, and listings.
export const CANNABIS_BROWSE_CATEGORIES = new Set<string>([
  'cannabis store', 'cannabis club', 'smoke shop', 'tobacco shop',
  'vaporizer store', 'cigar shop', 'hookah store', 'hookah bar',
  'herbal medicine store', 'herb shop', 'grow shop', 'smart shop',
  'dispensary', 'hemp store', 'delivery service', 'store',
]);

export const LISTINGS_PER_PAGE = 20;
export const MAX_SPONSORED = 3;
export const MIN_CITY_CATEGORY = 3;

// Reserved URL root segments — a stateCitySlug may not collide with any of these.
export const RESERVED_ROOT = new Set<string>([
  'listing', 'category', 'rating', 'search',
  'sitemap-index.xml', 'robots.txt', 'favicon.ico',
  'assets', 'images', '_astro', 'api',
]);
