export const BASE_URL = import.meta.env.SITE_URL || 'https://weedspots.io';

// ─── Cannabis category allowlist ─────────────────────────────────────────────
// Only these categories appear in Browse by Category / category pages.
// Businesses outside this list still appear in city pages, search, and listings.
export const CANNABIS_BROWSE_CATEGORIES = new Set([
  'cannabis store', 'cannabis club', 'smoke shop', 'tobacco shop',
  'vaporizer store', 'cigar shop', 'hookah store', 'hookah bar',
  'herbal medicine store', 'herb shop', 'grow shop', 'smart shop',
  'dispensary', 'hemp store', 'delivery service', 'store',
]);

// Returns the most accurate cannabis-relevant category for a business.
// Prefers primaryGoogleCategory; promotes from additionalGoogleCategories if the
// primary isn't cannabis-relevant; falls back to the scraped category field.
export function effectiveCategory(b: {
  primaryGoogleCategory?: string;
  additionalGoogleCategories?: string[];
  category?: string;
}): string {
  const primary = (b.primaryGoogleCategory || '').trim();
  if (primary && CANNABIS_BROWSE_CATEGORIES.has(primary.toLowerCase())) return primary;

  const cannabisAdditional = (b.additionalGoogleCategories || [])
    .map(c => c.trim())
    .find(c => CANNABIS_BROWSE_CATEGORIES.has(c.toLowerCase()));
  if (cannabisAdditional) return cannabisAdditional;

  return primary || b.category || 'Other';
}
export const LISTINGS_PER_PAGE = 20;
export const MAX_SPONSORED = 3;
export const MIN_CITY_CATEGORY = 3;
export const YEAR = new Date().getFullYear();
export const BUILD_DATE = new Date().toISOString().split('T')[0];

// ─── Slugs ──────────────────────────────────────────────────────────────────
export function citySlug(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function categorySlug(label: string): string {
  return String(label || 'other')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Category meta ──────────────────────────────────────────────────────────
export function categoryIcon(label: string): string {
  const l = (label || '').toLowerCase();
  if (l.includes('cannabis') || l.includes('weed') || l.includes('dispensary')) return '🌿';
  if (l.includes('smoke') || l.includes('tobacco') || l.includes('cigar') || l.includes('hookah')) return '🚬';
  if (l.includes('vapor') || l.includes('vape')) return '☁';
  if (l.includes('delivery')) return '🚚';
  if (l.includes('clinic') || l.includes('medical') || l.includes('doctor') || l.includes('pharmacy')) return '⚕';
  if (l.includes('wellness') || l.includes('health')) return '✨';
  if (l.includes('farm') || l.includes('herb') || l.includes('garden') || l.includes('grow')) return '🌱';
  if (l.includes('store') || l.includes('shop')) return '🏪';
  return '📌';
}

export function categoryMeta(dbCategory: string) {
  const display = dbCategory || 'Other';
  return { display, icon: categoryIcon(display), slug: categorySlug(display) };
}

// ─── Display helpers ─────────────────────────────────────────────────────────
export function truncate(str: string, len: number): string {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.slice(0, len).replace(/\s+\S*$/, '') + '...';
}

export function websiteDisplay(url: string): string {
  if (!url) return '';
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

export function businessStatusDisplay(status: string): string {
  const map: Record<string, string> = {
    OPERATIONAL: 'Open',
    CLOSED_TEMPORARILY: 'Temporarily Closed',
    CLOSED_PERMANENTLY: 'Permanently Closed',
  };
  return map[status] || status || 'Open';
}

export function osmBbox(lat: number, lng: number, delta = 0.01): string {
  return `${(lng - delta).toFixed(5)}%2C${(lat - delta).toFixed(5)}%2C${(lng + delta).toFixed(5)}%2C${(lat + delta).toFixed(5)}`;
}

// ─── Sorting ─────────────────────────────────────────────────────────────────
function ratingTier(r: number): number {
  if (r >= 4.9) return 5;
  if (r >= 4.4) return 4.5;
  if (r >= 3.9) return 4;
  if (r >= 3.4) return 3.5;
  return Math.floor(r);
}

function newestReviewTs(b: any): number {
  const reviews = b.reviews || [];
  if (!reviews.length) return 0;
  return Math.max(...reviews.map((r: any) => r.date ? new Date(r.date).getTime() : 0));
}

export function rankSort(a: any, b: any): number {
  const tierDiff = ratingTier(b.rating || 0) - ratingTier(a.rating || 0);
  if (tierDiff !== 0) return tierDiff;
  const countDiff = (b.reviewCount || 0) - (a.reviewCount || 0);
  if (countDiff !== 0) return countDiff;
  return newestReviewTs(b) - newestReviewTs(a);
}

// ─── Sponsorship ─────────────────────────────────────────────────────────────
export function getSponsored(businesses: any[]): any[] {
  const now = Date.now();
  return businesses
    .filter(b => b.isSponsored && b.sponsoredUntil && new Date(b.sponsoredUntil).getTime() >= now)
    .slice(0, MAX_SPONSORED);
}

export function getNonSponsored(businesses: any[]): any[] {
  const sponsoredIds = new Set(getSponsored(businesses).map(b => b.placeId));
  return businesses.filter(b => !sponsoredIds.has(b.placeId));
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function paginationData(currentPage: number, totalPages: number, baseUrl: string) {
  if (totalPages <= 1) return { hasPagination: false, pages: [], currentPage, totalPages, prevPage: null, nextPage: null };
  const pages = Array.from({ length: totalPages }, (_, i) => ({
    num: i + 1,
    url: i === 0 ? baseUrl : `${baseUrl}page/${i + 1}/`,
    isCurrent: i + 1 === currentPage,
  }));
  return {
    hasPagination: true,
    currentPage,
    totalPages,
    pages,
    prevPage: currentPage > 1 ? (currentPage - 1 === 1 ? baseUrl : `${baseUrl}page/${currentPage - 1}/`) : null,
    nextPage: currentPage < totalPages ? `${baseUrl}page/${currentPage + 1}/` : null,
  };
}

// ─── Schema.org ──────────────────────────────────────────────────────────────
export function localBusinessSchema(b: any): string {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: b.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.street || '',
      addressLocality: b.city || '',
      addressRegion: b.state || '',
      addressCountry: 'US',
      postalCode: b.postalCode || '',
    },
    ...(b.phone && { telephone: b.phone }),
    ...(b.website && { url: b.website }),
    ...(b.rating && { aggregateRating: { '@type': 'AggregateRating', ratingValue: b.rating, reviewCount: b.reviewCount || 0 } }),
    ...(b.lat && b.lng && { geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } }),
  };
  return JSON.stringify(schema);
}

export function itemListSchema(title: string, items: any[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: { '@type': 'LocalBusiness', name: item.name, url: `${BASE_URL}/listing/${item.slug}/` },
    })),
  });
}

export function faqSchema(faqs: Array<{ q: string; a: string }>): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });
}

export function breadcrumbSchema(crumbs: Array<{ name: string; url?: string }>): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: `${BASE_URL}${c.url}` } : {}),
    })),
  });
}
