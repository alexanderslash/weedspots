import type { APIRoute } from 'astro';
import { getAllData } from '../lib/data';
import { categorySlug } from '../lib/slugs';
import { LISTINGS_PER_PAGE } from '../lib/constants';
import { paginate } from '../lib/pagination';

export async function getStaticPaths() {
  const { businesses } = getAllData();
  const chunks = Math.ceil(businesses.length / 5000);
  const kinds = [
    'homepage',
    'cities',
    'categories',
    'rating',
    ...Array.from({ length: chunks }, (_, i) => `listings-${i + 1}`),
  ];
  return kinds.map(k => ({ params: { kind: k } }));
}

function urlTag(loc: string): string {
  return `  <url><loc>${loc}</loc></url>`;
}

export const GET: APIRoute = ({ params }) => {
  const siteUrl = import.meta.env.SITE_URL || 'https://weedspots.io';
  const { businesses, cities, categories, byStateCity } = getAllData();
  const kind = params.kind as string;

  let urls: string[] = [];

  if (kind === 'homepage') {
    urls = [`${siteUrl}/`, `${siteUrl}/category/`, `${siteUrl}/search/`];
  } else if (kind === 'cities') {
    for (const c of cities) {
      urls.push(`${siteUrl}/${c.stateCitySlug}/`);
      urls.push(`${siteUrl}/${c.stateCitySlug}/top-rated/`);
      const cityBiz = byStateCity.get(c.stateCitySlug) || [];
      const byCat = new Map<string, number>();
      for (const b of cityBiz) byCat.set(b.category, (byCat.get(b.category) || 0) + 1);
      for (const [cat, count] of byCat.entries()) {
        if (count < 3) continue;
        const slug = categorySlug(cat);
        const pages = Math.ceil(count / LISTINGS_PER_PAGE);
        urls.push(`${siteUrl}/${c.stateCitySlug}/${slug}/`);
        for (let i = 2; i <= pages; i++) {
          urls.push(`${siteUrl}/${c.stateCitySlug}/${slug}/page/${i}/`);
        }
      }
    }
  } else if (kind === 'categories') {
    for (const cat of categories) {
      const pages = Math.ceil(cat.count / LISTINGS_PER_PAGE);
      urls.push(`${siteUrl}/category/${cat.slug}/`);
      for (let i = 2; i <= pages; i++) {
        urls.push(`${siteUrl}/category/${cat.slug}/page/${i}/`);
      }
    }
  } else if (kind === 'rating') {
    const tiers = [
      { slug: '5-star', min: 4.9 },
      { slug: '4-star', min: 3.9 },
    ];
    for (const t of tiers) {
      const count = businesses.filter(b => (b.rating || 0) >= t.min).length;
      const pages = Math.ceil(count / LISTINGS_PER_PAGE);
      urls.push(`${siteUrl}/rating/${t.slug}/`);
      for (let i = 2; i <= pages; i++) {
        urls.push(`${siteUrl}/rating/${t.slug}/page/${i}/`);
      }
    }
  } else if (kind.startsWith('listings-')) {
    const idx = parseInt(kind.split('-')[1], 10) - 1;
    const chunks = paginate(businesses, 5000);
    const chunk = chunks[idx] || [];
    urls = chunk.map(b => `${siteUrl}/listing/${b.slug}/`);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlTag).join('\n')}
</urlset>`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
