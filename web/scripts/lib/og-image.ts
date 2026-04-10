import { load } from 'cheerio';

const PREFERRED_META = [
  { selector: 'meta[property="og:image"]', attr: 'content' },
  { selector: 'meta[name="og:image"]', attr: 'content' },
  { selector: 'meta[property="og:image:secure_url"]', attr: 'content' },
  { selector: 'meta[name="twitter:image"]', attr: 'content' },
  { selector: 'meta[name="twitter:image:src"]', attr: 'content' },
];

/**
 * Extract an og:image / twitter:image URL from HTML.
 * Resolves relative URLs against `baseUrl` and rejects non-http(s) schemes.
 * Returns null if no usable image is found.
 */
export function extractOgImage(html: string, baseUrl: string): string | null {
  const $ = load(html);
  for (const { selector, attr } of PREFERRED_META) {
    const raw = $(selector).attr(attr);
    if (!raw) continue;
    try {
      const resolved = new URL(raw, baseUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
      return resolved.toString();
    } catch {
      continue;
    }
  }
  return null;
}
