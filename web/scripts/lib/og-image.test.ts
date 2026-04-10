import { describe, it, expect } from 'vitest';
import { extractOgImage } from './og-image';

describe('extractOgImage', () => {
  it('finds og:image with property attribute', () => {
    const html = `<html><head>
      <meta property="og:image" content="https://example.com/hero.jpg">
    </head></html>`;
    expect(extractOgImage(html, 'https://example.com/')).toBe('https://example.com/hero.jpg');
  });

  it('finds og:image with name attribute', () => {
    const html = `<meta name="og:image" content="/hero.jpg">`;
    expect(extractOgImage(html, 'https://example.com/shop/')).toBe('https://example.com/hero.jpg');
  });

  it('prefers og:image over twitter:image', () => {
    const html = `
      <meta name="twitter:image" content="https://example.com/twit.jpg">
      <meta property="og:image" content="https://example.com/og.jpg">
    `;
    expect(extractOgImage(html, 'https://example.com/')).toBe('https://example.com/og.jpg');
  });

  it('falls back to twitter:image when og:image is missing', () => {
    const html = `<meta name="twitter:image" content="https://example.com/twit.jpg">`;
    expect(extractOgImage(html, 'https://example.com/')).toBe('https://example.com/twit.jpg');
  });

  it('resolves relative URLs against the base', () => {
    const html = `<meta property="og:image" content="images/a.jpg">`;
    expect(extractOgImage(html, 'https://example.com/shop/')).toBe('https://example.com/shop/images/a.jpg');
  });

  it('rejects non-http(s) schemes', () => {
    const html = `<meta property="og:image" content="javascript:alert(1)">`;
    expect(extractOgImage(html, 'https://example.com/')).toBeNull();
  });

  it('returns null when no image meta is present', () => {
    expect(extractOgImage('<html><head></head></html>', 'https://example.com/')).toBeNull();
  });
});
