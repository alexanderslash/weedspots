import type { APIRoute } from 'astro';
import { BASE_URL } from '../lib/utils';

export const GET: APIRoute = () => {
  return new Response(
    `User-agent: *\nDisallow: /\n`,
    { headers: { 'Content-Type': 'text/plain' } }
  );
};
