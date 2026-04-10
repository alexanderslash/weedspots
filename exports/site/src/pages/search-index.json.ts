import type { APIRoute } from 'astro';
import { getAllData } from '../lib/db';
import { categoryMeta } from '../lib/utils';

export const GET: APIRoute = async () => {
  const { businesses } = await getAllData();
  const index = businesses.map(b => ({
    slug: b.slug,
    name: b.name,
    city: b.city || '',
    category: categoryMeta(b.category).display,
    rating: b.rating || 0,
    address: b.shortAddress || '',
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
};
