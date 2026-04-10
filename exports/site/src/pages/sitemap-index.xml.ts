import type { APIRoute } from 'astro';
import { BASE_URL, BUILD_DATE } from '../lib/utils';
import { getAllData } from '../lib/db';
import { citySlug, categorySlug, categoryMeta } from '../lib/utils';

export const GET: APIRoute = async () => {
  const { businesses, cityMap, categoryCounts } = await getAllData();

  const sitemapNames = [
    'sitemap-homepage.xml',
    'sitemap-cities.xml',
    'sitemap-categories.xml',
    'sitemap-top10.xml',
  ];

  // Listing sitemaps split at 5000
  const listingCount = businesses.length;
  const chunks = Math.ceil(listingCount / 5000);
  if (chunks <= 1) {
    sitemapNames.push('sitemap-listings.xml');
  } else {
    for (let i = 1; i <= chunks; i++) sitemapNames.push(`sitemap-listings-${i}.xml`);
  }

  const entries = sitemapNames.map(name =>
    `  <sitemap>\n    <loc>${BASE_URL}/${name}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n  </sitemap>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
