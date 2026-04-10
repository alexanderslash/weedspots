'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const Handlebars = require('handlebars');
const mongoose = require('mongoose');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');

const {
  categoryMeta, categorySlug,
  starsHtml, citySlug, truncate,
  businessStatusDisplay, websiteDisplay, encodeURIComp,
  paginationData,
} = require('./helpers');

// ─── Constants ──────────────────────────────────────────────────────────────
const BASE_URL = process.env.SITE_URL || 'https://weedspots.io';
const DIST_NEW = path.join(__dirname, '..', 'dist_new');
const DIST = path.join(__dirname, '..', 'dist');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const ASSETS_SRC = path.join(__dirname, 'assets');
const LISTINGS_PER_PAGE = 20;
const MIN_LISTINGS_CITY_CATEGORY = 3;
const MAX_SPONSORED_PER_PAGE = 3;
const YEAR = new Date().getFullYear();
const BUILD_DATE = new Date().toISOString().split('T')[0];

// Categories allowed to appear in Browse by Category / category pages.
// Businesses outside this list still appear on city pages, search, and listing pages —
// they just don't get their own category browse page.
const CANNABIS_BROWSE_CATEGORIES = new Set([
  'cannabis store', 'cannabis club', 'smoke shop', 'tobacco shop',
  'vaporizer store', 'cigar shop', 'hookah store', 'hookah bar',
  'herbal medicine store', 'herb shop', 'grow shop', 'smart shop',
  'dispensary', 'hemp store', 'delivery service', 'store',
]);

// ─── MongoDB models (reuse from scraper) ────────────────────────────────────
require('../models');
const Business = mongoose.model('Business');

// ─── Handlebars helpers ─────────────────────────────────────────────────────
Handlebars.registerHelper('encodeURIComponent', s => encodeURIComp(s));
Handlebars.registerHelper('eq', (a, b) => a === b);

// ─── Template loading ───────────────────────────────────────────────────────
let layoutTemplate, templates;

function loadTemplates() {
  const layoutSrc = fs.readFileSync(path.join(TEMPLATES_DIR, 'layout.html'), 'utf8');
  layoutTemplate = Handlebars.compile(layoutSrc);

  const names = ['homepage', 'city', 'categories', 'category', 'city-category', 'top10', 'listing', 'search', 'rating'];
  templates = {};
  for (const name of names) {
    templates[name] = Handlebars.compile(
      fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.html`), 'utf8')
    );
  }
}

// ─── Render page helper ─────────────────────────────────────────────────────
async function renderPage(templateName, data, outputPath) {
  const body = templates[templateName](data);
  const html = layoutTemplate({ ...data, body, year: YEAR, baseUrl: BASE_URL });

  let minified;
  try {
    minified = await minifyHtml(html, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true,
    });
  } catch {
    minified = html;
  }

  const fullPath = path.join(DIST_NEW, outputPath);
  await fsp.mkdir(path.dirname(fullPath), { recursive: true });
  await fsp.writeFile(fullPath, minified, 'utf8');
}

// ─── Sorting ────────────────────────────────────────────────────────────────
function ratingTier(r) {
  if (r >= 4.9) return 5;
  if (r >= 4.4) return 4.5;
  if (r >= 3.9) return 4;
  if (r >= 3.4) return 3.5;
  return Math.floor(r);
}

function newestReviewTs(b) {
  const reviews = b.reviews || [];
  if (reviews.length === 0) return 0;
  let max = 0;
  for (const r of reviews) {
    const ts = r.date ? new Date(r.date).getTime() : 0;
    if (ts > max) max = ts;
  }
  return max;
}

function rankSort(a, b) {
  const tierDiff = ratingTier(b.rating || 0) - ratingTier(a.rating || 0);
  if (tierDiff !== 0) return tierDiff;
  const countDiff = (b.reviewCount || 0) - (a.reviewCount || 0);
  if (countDiff !== 0) return countDiff;
  return newestReviewTs(b) - newestReviewTs(a);
}

// ─── Data helpers ───────────────────────────────────────────────────────────
// Prefer the Google Maps-scraped category (more accurate) over the Places API category.
// If the primary isn't cannabis-relevant, promote the first cannabis-relevant additional category.
function effectiveCategory(b) {
  const primary = (b.primaryGoogleCategory || b.category || '').trim();
  if (primary && CANNABIS_BROWSE_CATEGORIES.has(primary.toLowerCase())) return primary;

  const cannabisAdditional = (b.additionalGoogleCategories || [])
    .map(c => c.trim())
    .find(c => CANNABIS_BROWSE_CATEGORIES.has(c.toLowerCase()));
  if (cannabisAdditional) return cannabisAdditional;

  return primary || 'Other';
}

function enrichBusiness(b) {
  const meta = categoryMeta(effectiveCategory(b));
  return {
    ...b,
    rating: (b.rating || 0).toFixed(1),
    starsHtml: starsHtml(b.rating),
    categoryDisplay: meta.display,
    categorySlug: meta.slug,
    citySlug: citySlug(b.city || ''),
    websiteDisplay: websiteDisplay(b.website),
    businessStatusDisplay: businessStatusDisplay(b.businessStatus),
  };
}

function geographyLabel(businesses) {
  const states = [...new Set(businesses.map(b => b.state).filter(Boolean))];
  if (states.length === 1) return states[0];
  if (states.length > 1) return 'the United States';
  return 'the directory';
}

function categoryCountsFromBusinesses(businesses) {
  const counts = {};
  for (const b of businesses) {
    const cat = effectiveCategory(b);
    // Only include cannabis-relevant categories in browse/category pages
    if (!CANNABIS_BROWSE_CATEGORIES.has(cat.toLowerCase())) continue;
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

function categoryDescription(label, count, geoLabel) {
  return `Browse ${count} businesses labeled by Google as ${label} on Weedspots.io${geoLabel ? ` in ${geoLabel}` : ''}. Compare ratings, reviews, hours, addresses, and map links.`;
}

function categoryLongDescription(label, count, geoLabel) {
  return `${label} is one of the live business categories captured from Google Places data in Weedspots.io. This page currently includes ${count} listings${geoLabel ? ` in ${geoLabel}` : ''}, with business details such as ratings, reviews, opening hours, contact information, and map links to help users compare weed-related businesses more quickly.`;
}

function getSponsored(businesses, limit = MAX_SPONSORED_PER_PAGE) {
  const now = Date.now();
  return businesses
    .filter(b => b.isSponsored && b.sponsoredUntil && new Date(b.sponsoredUntil).getTime() >= now)
    .slice(0, limit);
}

function getNonSponsored(businesses) {
  const now = Date.now();
  const sponsoredIds = new Set(
    getSponsored(businesses).map(b => b.placeId)
  );
  return businesses.filter(b => !sponsoredIds.has(b.placeId));
}

function osmBbox(lat, lng, delta = 0.01) {
  return `${(lng - delta).toFixed(5)}%2C${(lat - delta).toFixed(5)}%2C${(lng + delta).toFixed(5)}%2C${(lat + delta).toFixed(5)}`;
}

// ─── Schema markup generators ───────────────────────────────────────────────
function schemaTag(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function localBusinessSchema(b) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: b.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.street || '',
      addressLocality: b.city || '',
      addressRegion: b.state || b.county || '',
      addressCountry: 'US',
      postalCode: b.postalCode || '',
    },
    ...(b.phone && { telephone: b.phone }),
    ...(b.website && { url: b.website }),
    ...(b.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: b.rating,
        reviewCount: b.reviewCount || 0,
      },
    }),
    ...(b.lat && b.lng && { geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } }),
  };
  return schemaTag(schema);
}

function itemListSchema(title, items, baseUrl) {
  return schemaTag({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name: item.name,
        url: `${baseUrl}/listing/${item.slug}/`,
      },
    })),
  });
}

function breadcrumbSchema(crumbs) {
  return schemaTag({
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

// ─── Build phases ───────────────────────────────────────────────────────────

async function buildHomepage(businesses, cityMap, categoryCounts) {
  const geoLabel = geographyLabel(businesses);
  const topRated = businesses
    .filter(b => b.rating >= 4 && b.reviewCount >= 3)
    .sort(rankSort)
    .slice(0, 12)
    .map(enrichBusiness);

  const recentlyAdded = [...businesses]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map(enrichBusiness);

  const categories = Object.entries(categoryCounts)
    .map(([db, count]) => {
      const meta = categoryMeta(db);
      return { ...meta, displayName: meta.display, count };
    })
    .sort((a, b) => b.count - a.count);

  const cities = [...cityMap.entries()]
    .map(([name, list]) => ({ name, slug: citySlug(name), count: list.length }))
    .sort((a, b) => b.count - a.count);

  await renderPage('homepage', {
    title: `Weedspots.io | Find Cannabis Stores, Smoke Shops & Weed Services in ${geoLabel}`,
    metaDescription: `Browse ${businesses.length} weed-related businesses across ${cities.length} cities on Weedspots.io. Ratings, reviews, store types, hours, and contact details sourced from Google.`,
    canonicalUrl: BASE_URL + '/',
    topRated,
    recentlyAdded,
    categories,
    cities,
    totalListings: businesses.length,
    totalCities: cities.length,
  }, 'index.html');

  console.log('  ✓ Homepage');
}

async function buildCityPages(businesses, cityMap) {
  let count = 0;
  const tasks = [];

  for (const [city, cityBusinesses] of cityMap) {
    const state = cityBusinesses[0]?.state || '';
    const slug = citySlug(city);
    const sorted = cityBusinesses.sort(rankSort);
    const sponsored = getSponsored(sorted).map(enrichBusiness);
    const top10 = sorted
      .filter(b => !getSponsored(sorted).some(s => s.placeId === b.placeId))
      .slice(0, 10)
      .map((b, i) => ({ ...enrichBusiness(b), rank: i + 1 }));

    const catGroupMap = {};
    for (const b of sorted) {
      const cat = effectiveCategory(b);
      if (!catGroupMap[cat]) catGroupMap[cat] = [];
      catGroupMap[cat].push(enrichBusiness(b));
    }
    const categoryGroups = Object.entries(catGroupMap).map(([cat, listings]) => {
      const meta = categoryMeta(cat);
      return {
        displayName: meta.display,
        categorySlug: meta.slug,
        listings: listings.slice(0, 6),
        hasMore: listings.length > 6,
      };
    });

    const breadcrumbs = [
      { name: 'Home', url: '/', position: 1 },
      { name: city, position: 2 },
    ];

    tasks.push(renderPage('city', {
      title: `${city}${state ? `, ${state}` : ''} Cannabis Stores, Smoke Shops & Weed Services | Weedspots.io`,
      metaDescription: `Browse ${cityBusinesses.length} weed-related businesses in ${city}${state ? `, ${state}` : ''}. Compare ratings, reviews, hours, and contact details.`,
      canonicalUrl: `${BASE_URL}/dispensaries/${slug}/`,
      schemaMarkup: breadcrumbSchema(breadcrumbs),
      breadcrumbs,
      cityName: city,
      stateName: state,
      citySlug: slug,
      totalListings: cityBusinesses.length,
      sponsoredListings: sponsored,
      top10,
      categoryGroups,
    }, `dispensaries/${slug}/index.html`));

    count++;
  }

  await Promise.all(tasks);
  console.log(`  ✓ ${count} city pages`);
}

async function buildCategoriesIndex(categoryCounts) {
  const categories = Object.entries(categoryCounts)
    .map(([db, count]) => {
      const meta = categoryMeta(db);
      return { ...meta, displayName: meta.display, count };
    })
    .sort((a, b) => b.count - a.count);

  const breadcrumbs = [
    { name: 'Home', url: '/', position: 1 },
    { name: 'Categories', position: 2 },
  ];

  await renderPage('categories', {
    title: 'All Weed Business Categories | Weedspots.io',
    metaDescription: 'Browse all Google business categories currently listed on Weedspots.io, including cannabis stores, smoke shops, vaporizer stores, delivery services, and more.',
    canonicalUrl: `${BASE_URL}/category/`,
    schemaMarkup: breadcrumbSchema(breadcrumbs),
    breadcrumbs,
    categories,
  }, 'category/index.html');

  console.log('  ✓ Categories index');
}

async function buildCategoryPages(businesses, categoryCounts) {
  let pageCount = 0;
  const tasks = [];

  for (const dbCat of Object.keys(categoryCounts)) {
    const meta = categoryMeta(dbCat);
    const catSlug = meta.slug;
    const catBusinesses = businesses
      .filter(b => effectiveCategory(b) === dbCat)
      .sort(rankSort);

    if (catBusinesses.length === 0) continue;

    const totalPages = Math.ceil(catBusinesses.length / LISTINGS_PER_PAGE);
    const sponsored = getSponsored(catBusinesses).map(enrichBusiness);
    const nonSponsored = getNonSponsored(catBusinesses);

    for (let page = 1; page <= totalPages; page++) {
      const start = (page - 1) * LISTINGS_PER_PAGE;
      const pageListings = nonSponsored.slice(start, start + LISTINGS_PER_PAGE).map(enrichBusiness);
      const pagination = paginationData(page, totalPages, `/category/${catSlug}/`);
      const outPath = page === 1 ? `category/${catSlug}/index.html` : `category/${catSlug}/page/${page}/index.html`;

      const breadcrumbs = [
        { name: 'Home', url: '/', position: 1 },
        { name: 'Categories', url: '/category/', position: 2 },
        { name: meta.display, position: 3 },
      ];

      tasks.push(renderPage('category', {
        title: `${meta.display}${page > 1 ? ` | Page ${page}` : ''} | Weedspots.io`,
        metaDescription: `${categoryDescription(meta.display, catBusinesses.length, geographyLabel(catBusinesses))}${page > 1 ? ` Page ${page}.` : ''}`,
        canonicalUrl: `${BASE_URL}${page === 1 ? `/category/${catSlug}/` : `/category/${catSlug}/page/${page}/`}`,
        schemaMarkup: breadcrumbSchema(breadcrumbs),
        breadcrumbs,
        categoryDisplayName: meta.display,
        categoryDescription: categoryDescription(meta.display, catBusinesses.length, geographyLabel(catBusinesses)),
        categoryLongDescription: categoryLongDescription(meta.display, catBusinesses.length, geographyLabel(catBusinesses)),
        sponsoredListings: page === 1 ? sponsored : [],
        listings: pageListings,
        ...pagination,
      }, outPath));

      pageCount++;
    }
  }

  await Promise.all(tasks);
  console.log(`  ✓ ${pageCount} category pages`);
}

async function buildCityCategoryPages(businesses, cityMap) {
  let count = 0;
  const tasks = [];

  for (const [city, cityBusinesses] of cityMap) {
    const state = cityBusinesses[0]?.state || '';
    const cSlug = citySlug(city);

    for (const dbCat of Object.keys(categoryCountsFromBusinesses(cityBusinesses))) {
      const meta = categoryMeta(dbCat);
      const catSlug = meta.slug;
      const filtered = cityBusinesses
        .filter(b => effectiveCategory(b) === dbCat)
        .sort(rankSort);

      if (filtered.length < MIN_LISTINGS_CITY_CATEGORY) continue;

      const totalPages = Math.ceil(filtered.length / LISTINGS_PER_PAGE);
      const sponsored = getSponsored(filtered).map(enrichBusiness);
      const nonSponsored = getNonSponsored(filtered);

      for (let page = 1; page <= totalPages; page++) {
        const start = (page - 1) * LISTINGS_PER_PAGE;
        const pageListings = nonSponsored.slice(start, start + LISTINGS_PER_PAGE).map(enrichBusiness);
        const pagination = paginationData(page, totalPages, `/dispensaries/${cSlug}/${catSlug}/`);
        const outPath = page === 1
          ? `dispensaries/${cSlug}/${catSlug}/index.html`
          : `dispensaries/${cSlug}/${catSlug}/page/${page}/index.html`;

        const breadcrumbs = [
          { name: 'Home', url: '/', position: 1 },
          { name: meta.display, url: `/category/${catSlug}/`, position: 2 },
          { name: city, url: `/dispensaries/${cSlug}/`, position: 3 },
          { name: `${meta.display} in ${city}`, position: 4 },
        ];

        tasks.push(renderPage('city-category', {
          title: `${meta.display} in ${city}${state ? `, ${state}` : ''}${page > 1 ? ` | Page ${page}` : ''} | Weedspots.io`,
          metaDescription: `Browse ${filtered.length} ${meta.display.toLowerCase()} listings in ${city}${state ? `, ${state}` : ''}. Compare ratings, reviews, hours, and contact details.`,
          canonicalUrl: `${BASE_URL}${page === 1 ? `/dispensaries/${cSlug}/${catSlug}/` : `/dispensaries/${cSlug}/${catSlug}/page/${page}/`}`,
          schemaMarkup: breadcrumbSchema(breadcrumbs),
          breadcrumbs,
          cityName: city,
          stateName: state,
          citySlug: cSlug,
          categoryDisplayName: meta.display,
          categoryDisplayNameLower: meta.display.toLowerCase(),
          totalListings: filtered.length,
          sponsoredListings: page === 1 ? sponsored : [],
          listings: pageListings,
          ...pagination,
        }, outPath));

        count++;
      }
    }
  }

  await Promise.all(tasks);
  console.log(`  ✓ ${count} city+category pages`);
}

async function buildTop10Pages(cityMap) {
  let count = 0;
  const tasks = [];

  for (const [city, cityBusinesses] of cityMap) {
    const state = cityBusinesses[0]?.state || '';
    const slug = citySlug(city);
    const top = cityBusinesses
      .sort(rankSort)
      .slice(0, 10);

    const listings = top.map((b, i) => {
      const enriched = enrichBusiness(b);
      const topReview = (b.reviews || []).find(r => r.text && r.text.length > 20);
      return {
        ...enriched,
        rank: i + 1,
        topReview: topReview ? { text: truncate(topReview.text, 200), author: topReview.author } : null,
      };
    });

    const breadcrumbs = [
      { name: 'Home', url: '/', position: 1 },
      { name: 'Top Rated', url: '/top-rated/', position: 2 },
      { name: city, position: 3 },
    ];

    tasks.push(renderPage('top10', {
      title: `Top Rated Weed Businesses in ${city}${state ? `, ${state}` : ''} (${YEAR}) | Weedspots.io`,
      metaDescription: `The highest-rated weed-related businesses in ${city}${state ? `, ${state}` : ''}, ranked by customer reviews and rating. Updated ${BUILD_DATE}.`,
      canonicalUrl: `${BASE_URL}/top-rated/${slug}/`,
      schemaMarkup: breadcrumbSchema(breadcrumbs) + itemListSchema(`Top Rated Weed Businesses in ${city}`, listings, BASE_URL),
      breadcrumbs,
      cityName: city,
      stateName: state,
      year: YEAR,
      buildDate: BUILD_DATE,
      listings,
    }, `top-rated/${slug}/index.html`));

    count++;
  }

  await Promise.all(tasks);
  console.log(`  ✓ ${count} top-10 pages`);
}

async function buildListingPages(businesses) {
  const BATCH = 200;
  let count = 0;

  for (let i = 0; i < businesses.length; i += BATCH) {
    const batch = businesses.slice(i, i + BATCH);
    await Promise.all(batch.map(b => {
      const enriched = enrichBusiness(b);
      const reviews = (b.reviews || [])
        .sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        })
        .slice(0, 5)
        .map(r => ({
          ...r,
          rating: (r.rating || 0).toFixed(1),
          starsHtml: starsHtml(r.rating),
        }));

      const meta = categoryMeta(effectiveCategory(b));
      const breadcrumbs = [
        { name: 'Home', url: '/', position: 1 },
        { name: meta.display, url: `/category/${meta.slug}/`, position: 2 },
        ...(b.city ? [{ name: b.city, url: `/dispensaries/${citySlug(b.city)}/`, position: 3 }] : []),
        { name: b.name, position: b.city ? 4 : 3 },
      ];

      const raw = b.rawData || {};

      const parkingOptions = raw.parkingOptions || {};
      const parkingItems = [];
      if (parkingOptions.freeParkingLot) parkingItems.push('Free parking lot');
      if (parkingOptions.paidParkingLot) parkingItems.push('Paid parking lot');
      if (parkingOptions.freeStreetParking) parkingItems.push('Free street parking');
      if (parkingOptions.paidStreetParking) parkingItems.push('Paid street parking');
      if (parkingOptions.freeGarageParking) parkingItems.push('Free garage parking');
      if (parkingOptions.paidGarageParking) parkingItems.push('Paid garage parking');

      const accessibilityOptions = raw.accessibilityOptions || {};
      const accessibilityItems = [];
      if (accessibilityOptions.wheelchairAccessibleEntrance) accessibilityItems.push('Wheelchair accessible entrance');
      if (accessibilityOptions.wheelchairAccessibleParking) accessibilityItems.push('Wheelchair accessible parking');
      if (accessibilityOptions.wheelchairAccessibleRestroom) accessibilityItems.push('Wheelchair accessible restroom');
      if (accessibilityOptions.wheelchairAccessibleSeating) accessibilityItems.push('Wheelchair accessible seating');

      const paymentOptions = raw.paymentOptions || {};
      const paymentItems = [];
      if (paymentOptions.acceptsCreditCards) paymentItems.push('Credit cards');
      if (paymentOptions.acceptsDebitCards) paymentItems.push('Debit cards');
      if (paymentOptions.acceptsNfc) paymentItems.push('Contactless / NFC');
      if (paymentOptions.acceptsCashOnly) paymentItems.push('Cash only');

      const editorialSummary = raw.editorialSummary?.text || '';

      const relatedInCity = b.city
        ? businesses
            .filter(x => x.placeId !== b.placeId && effectiveCategory(x) === effectiveCategory(b) && x.city === b.city)
            .sort(rankSort)
            .slice(0, 6)
            .map(enrichBusiness)
        : [];

      return renderPage('listing', {
        title: `${b.name} | ${enriched.categoryDisplay}${b.city ? ` in ${b.city}` : ''} | Weedspots.io`,
        metaDescription: `${b.name}${b.city ? ` in ${b.city}${b.state ? `, ${b.state}` : ''}` : ''}. ${b.rating ? `Rated ${(b.rating).toFixed(1)}/5 from ${b.reviewCount} reviews.` : ''} Address, hours, reviews, and contact details on Weedspots.io.`,
        canonicalUrl: `${BASE_URL}/listing/${b.slug}/`,
        schemaMarkup: breadcrumbSchema(breadcrumbs) + localBusinessSchema(b),
        breadcrumbs,
        ...enriched,
        reviews,
        formattedAddress: b.formattedAddress,
        county: b.county || '',
        neighborhood: b.neighborhood || '',
        internationalPhone: b.internationalPhone || '',
        openingHours: b.openingHours,
        googleMapsLinks: b.googleMapsLinks || {},
        googleMapsUri: b.googleMapsUri || '',
        osmBbox: (b.lat && b.lng) ? osmBbox(b.lat, b.lng) : '',
        editorialSummary,
        parkingItems,
        accessibilityItems,
        paymentItems,
        pureServiceAreaBusiness: b.pureServiceAreaBusiness || false,
        relatedInCity,
      }, `listing/${b.slug}/index.html`);
    }));
    count += batch.length;
  }

  console.log(`  ✓ ${count} listing pages`);
}

async function buildRatingPages(businesses) {
  let count = 0;
  const tasks = [];

  for (const starCount of [5, 4]) {
    const threshold = starCount === 5 ? 4.5 : 3.5;
    const filtered = businesses
      .filter(b => (b.rating || 0) >= threshold)
      .sort((a, b) => b.reviewCount - a.reviewCount);

    if (filtered.length === 0) continue;

    const totalPages = Math.ceil(filtered.length / LISTINGS_PER_PAGE);
    const label = `${starCount}-star`;

    for (let page = 1; page <= totalPages; page++) {
      const start = (page - 1) * LISTINGS_PER_PAGE;
      const pageListings = filtered.slice(start, start + LISTINGS_PER_PAGE).map(enrichBusiness);
      const baseUrl = `/dispensaries/rating/${label}/`;
      const pagination = paginationData(page, totalPages, baseUrl);
      const outPath = page === 1
        ? `dispensaries/rating/${label}/index.html`
        : `dispensaries/rating/${label}/page/${page}/index.html`;

      const breadcrumbs = [
        { name: 'Home', url: '/', position: 1 },
        { name: 'Categories', url: '/category/', position: 2 },
        { name: `${starCount}-Star`, position: 3 },
      ];

      tasks.push(renderPage('rating', {
        title: `${starCount}-Star Weed Businesses${page > 1 ? ` | Page ${page}` : ''} | Weedspots.io`,
        metaDescription: `Browse ${filtered.length} weed-related businesses with a ${starCount}-star rating or higher, sorted by review count.`,
        canonicalUrl: `${BASE_URL}${page === 1 ? baseUrl : `/dispensaries/rating/${label}/page/${page}/`}`,
        schemaMarkup: breadcrumbSchema(breadcrumbs),
        breadcrumbs,
        starCount,
        totalListings: filtered.length,
        listings: pageListings,
        ...pagination,
      }, outPath));

      count++;
    }
  }

  await Promise.all(tasks);
  console.log(`  ✓ ${count} rating pages`);
}

async function buildSearchPage(businesses, categoryCounts) {
  const categories = Object.entries(categoryCounts)
    .map(([db, count]) => {
      const meta = categoryMeta(db);
      return { ...meta, displayName: meta.display, count };
    })
    .sort((a, b) => b.count - a.count);

  const breadcrumbs = [
    { name: 'Home', url: '/', position: 1 },
    { name: 'Search', position: 2 },
  ];

  await renderPage('search', {
    title: 'Search Weed Businesses | Weedspots.io',
    metaDescription: `Search ${businesses.length} weed-related businesses on Weedspots.io by name, city, address, or Google category.`,
    canonicalUrl: `${BASE_URL}/search/`,
    schemaMarkup: breadcrumbSchema(breadcrumbs),
    breadcrumbs,
    categories,
    totalListings: businesses.length,
  }, 'search/index.html');

  console.log('  ✓ Search page');
}

async function buildSearchIndex(businesses) {
  const index = businesses.map(b => ({
    slug: b.slug,
    name: b.name,
    city: b.city || '',
    category: effectiveCategory(b),
    rating: b.rating || 0,
    address: b.shortAddress || '',
  }));

  await fsp.writeFile(
    path.join(DIST_NEW, 'search-index.json'),
    JSON.stringify(index),
    'utf8'
  );
  console.log(`  ✓ Search index (${index.length} entries)`);
}

// ─── Sitemap generation ─────────────────────────────────────────────────────
function sitemapUrlEntry(loc, changefreq, priority) {
  return `  <url>\n    <loc>${BASE_URL}${loc}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

async function buildSitemaps(businesses, cityMap, categoryCounts) {
  const sitemaps = {};

  // Homepage
  sitemaps['sitemap-homepage.xml'] = [sitemapUrlEntry('/', 'daily', '1.0')];

  // Cities
  sitemaps['sitemap-cities.xml'] = [];
  for (const [city] of cityMap) {
    sitemaps['sitemap-cities.xml'].push(sitemapUrlEntry(`/dispensaries/${citySlug(city)}/`, 'daily', '0.9'));
  }

  // Categories
  sitemaps['sitemap-categories.xml'] = [sitemapUrlEntry('/category/', 'weekly', '0.9')];
  for (const dbCat of Object.keys(categoryCounts)) {
    const catSlug = categorySlug(dbCat);
    if ((categoryCounts[dbCat] || 0) > 0) {
      sitemaps['sitemap-categories.xml'].push(sitemapUrlEntry(`/category/${catSlug}/`, 'daily', '0.8'));
    }
  }

  // Top 10
  sitemaps['sitemap-top10.xml'] = [];
  for (const [city] of cityMap) {
    sitemaps['sitemap-top10.xml'].push(sitemapUrlEntry(`/top-rated/${citySlug(city)}/`, 'weekly', '0.8'));
  }

  // Listings (split at 5000)
  const listingUrls = businesses.map(b => sitemapUrlEntry(`/listing/${b.slug}/`, 'weekly', '0.7'));
  const listingSitemaps = [];
  for (let i = 0; i < listingUrls.length; i += 5000) {
    const chunk = listingUrls.slice(i, i + 5000);
    const idx = Math.floor(i / 5000) + 1;
    const name = listingUrls.length > 5000 ? `sitemap-listings-${idx}.xml` : 'sitemap-listings.xml';
    sitemaps[name] = chunk;
    listingSitemaps.push(name);
  }

  // Write individual sitemaps
  for (const [filename, entries] of Object.entries(sitemaps)) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;
    await fsp.writeFile(path.join(DIST_NEW, filename), xml, 'utf8');
  }

  // Write sitemap index
  const indexEntries = Object.keys(sitemaps).map(f =>
    `  <sitemap>\n    <loc>${BASE_URL}/${f}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n  </sitemap>`
  );
  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexEntries.join('\n')}\n</sitemapindex>`;
  await fsp.writeFile(path.join(DIST_NEW, 'sitemap-index.xml'), indexXml, 'utf8');

  console.log(`  ✓ ${Object.keys(sitemaps).length} sitemaps + index`);
}

async function buildRobotsTxt() {
  const content = `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${BASE_URL}/sitemap-index.xml\n`;
  await fsp.writeFile(path.join(DIST_NEW, 'robots.txt'), content, 'utf8');
  console.log('  ✓ robots.txt');
}

async function copyAssets() {
  const assetsOut = path.join(DIST_NEW, 'assets');
  await fsp.mkdir(assetsOut, { recursive: true });

  // Minify CSS
  const cssSrc = fs.readFileSync(path.join(ASSETS_SRC, 'style.css'), 'utf8');
  const minified = new CleanCSS({ level: 2 }).minify(cssSrc);
  await fsp.writeFile(path.join(assetsOut, 'style.min.css'), minified.styles, 'utf8');

  // Copy search.js
  const jsSrc = fs.readFileSync(path.join(ASSETS_SRC, 'search.js'), 'utf8');
  await fsp.writeFile(path.join(assetsOut, 'search.js'), jsSrc, 'utf8');

  // Copy any other static files from assets dir
  const files = await fsp.readdir(ASSETS_SRC);
  for (const f of files) {
    if (f === 'style.css' || f === 'search.js') continue;
    await fsp.copyFile(path.join(ASSETS_SRC, f), path.join(assetsOut, f));
  }

  console.log('  ✓ Static assets');
}

// ─── Atomic swap ────────────────────────────────────────────────────────────
async function atomicSwap() {
  const distBackup = DIST + '_old_' + Date.now();
  try {
    await fsp.access(DIST);
    await fsp.rename(DIST, distBackup);
  } catch { /* dist doesn't exist yet */ }

  await fsp.rename(DIST_NEW, DIST);

  // Clean up old backup
  try {
    await fsp.rm(distBackup, { recursive: true, force: true });
  } catch { /* no-op */ }
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Weedspots.io — Static Site Builder         ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // Connect to MongoDB
  console.log('→ Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('  ✓ Connected\n');

  // Load all data
  console.log('→ Loading data...');
  const allBusinesses = await Business.find({ businessStatus: 'OPERATIONAL' })
    .lean();
  console.log(`  ✓ ${allBusinesses.length} businesses loaded\n`);

  if (allBusinesses.length === 0) {
    console.log('⚠ No businesses found. Exiting.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Group by city
  const cityMap = new Map();
  for (const b of allBusinesses) {
    const c = b.city || 'Unknown';
    if (!cityMap.has(c)) cityMap.set(c, []);
    cityMap.get(c).push(b);
  }

  // Count by category (filtered to cannabis-relevant categories only)
  const categoryCounts = categoryCountsFromBusinesses(allBusinesses);

  // Load templates
  console.log('→ Loading templates...');
  loadTemplates();
  console.log('  ✓ Templates loaded\n');

  // Clean dist_new
  console.log('→ Preparing build directory...');
  await fsp.rm(DIST_NEW, { recursive: true, force: true });
  await fsp.mkdir(DIST_NEW, { recursive: true });
  console.log('  ✓ Ready\n');

  // Build all page types
  console.log('→ Building pages...');
  await buildHomepage(allBusinesses, cityMap, categoryCounts);
  await buildCityPages(allBusinesses, cityMap);
  await buildCategoriesIndex(categoryCounts);
  await buildCategoryPages(allBusinesses, categoryCounts);
  await buildCityCategoryPages(allBusinesses, cityMap);
  await buildTop10Pages(cityMap);
  await buildListingPages(allBusinesses);
  await buildRatingPages(allBusinesses);
  await buildSearchPage(allBusinesses, categoryCounts);
  await buildSearchIndex(allBusinesses);
  console.log('');

  // Generate sitemaps, robots.txt, copy assets
  console.log('→ Generating sitemaps & assets...');
  await buildSitemaps(allBusinesses, cityMap, categoryCounts);
  await buildRobotsTxt();
  await copyAssets();
  console.log('');

  // Atomic swap
  console.log('→ Swapping dist/ (atomic)...');
  await atomicSwap();
  console.log('  ✓ Swap complete\n');

  // Disconnect
  await mongoose.disconnect();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║  Build complete in ${elapsed}s`);
  console.log(`║  Businesses: ${allBusinesses.length}`);
  console.log(`║  Cities: ${cityMap.size}`);
  console.log('╚══════════════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('\n✖ Build failed:', err);
  process.exit(1);
});
