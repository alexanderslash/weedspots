import type { APIRoute } from 'astro';
import { getAllData } from '../lib/data';

export const GET: APIRoute = () => {
  const siteUrl = import.meta.env.SITE_URL || 'https://weedspots.io';
  const { businesses } = getAllData();
  const listingSitemapCount = Math.ceil(businesses.length / 5000);

  const kinds = [
    'homepage',
    'cities',
    'categories',
    'rating',
    ...Array.from({ length: listingSitemapCount }, (_, i) => `listings-${i + 1}`),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${kinds.map(k => `  <sitemap><loc>${siteUrl}/sitemap-${k}.xml</loc></sitemap>`).join('\n')}
</sitemapindex>`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
