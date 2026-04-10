import type { APIRoute, GetStaticPaths } from 'astro';
import { getAllData } from '../lib/db';
import { BASE_URL, BUILD_DATE, categoryMeta, citySlug, categorySlug } from '../lib/utils';

function url(loc: string, changefreq: string, priority: string) {
  return `  <url>\n    <loc>${BASE_URL}${loc}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function makeXml(entries: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const { businesses, cityMap, categoryCounts } = await getAllData();

  const sitemaps: Record<string, string[]> = {};

  sitemaps['sitemap-homepage'] = [url('/', 'daily', '1.0')];

  sitemaps['sitemap-cities'] = [...cityMap.keys()].map(city =>
    url(`/dispensaries/${citySlug(city)}/`, 'daily', '0.9')
  );

  sitemaps['sitemap-categories'] = [
    url('/category/', 'weekly', '0.9'),
    ...Object.keys(categoryCounts).map(cat =>
      url(`/category/${categoryMeta(cat).slug}/`, 'daily', '0.8')
    ),
  ];

  sitemaps['sitemap-top10'] = [...cityMap.keys()].map(city =>
    url(`/top-rated/${citySlug(city)}/`, 'weekly', '0.8')
  );

  const listingUrls = businesses.map(b => url(`/listing/${b.slug}/`, 'weekly', '0.7'));
  const chunks = Math.ceil(listingUrls.length / 5000);
  if (chunks <= 1) {
    sitemaps['sitemap-listings'] = listingUrls;
  } else {
    for (let i = 0; i < chunks; i++) {
      sitemaps[`sitemap-listings-${i + 1}`] = listingUrls.slice(i * 5000, (i + 1) * 5000);
    }
  }

  return Object.entries(sitemaps).map(([name, entries]) => ({
    params: { sitemap: name },
    props: { entries },
  }));
};

export const GET: APIRoute = ({ props }) => {
  return new Response(makeXml(props.entries as string[]), {
    headers: { 'Content-Type': 'application/xml' },
  });
};
