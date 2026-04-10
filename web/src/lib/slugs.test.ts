// web/src/lib/slugs.test.ts
import { describe, it, expect } from 'vitest';
import { citySlug, categorySlug, stateCitySlug } from './slugs';

describe('citySlug', () => {
  it('lowercases and hyphenates', () => {
    expect(citySlug('New York')).toBe('new-york');
  });
  it('strips punctuation', () => {
    expect(citySlug("St. John's")).toBe('st-johns');
  });
  it('collapses whitespace and hyphens', () => {
    expect(citySlug('  Foo   Bar--Baz ')).toBe('foo-bar-baz');
  });
  it('returns empty string for empty input', () => {
    expect(citySlug('')).toBe('');
  });
});

describe('categorySlug', () => {
  it('replaces & with "and"', () => {
    expect(categorySlug('Health & Wellness')).toBe('health-and-wellness');
  });
  it('falls back to "other" for empty input', () => {
    expect(categorySlug('')).toBe('other');
  });
  it('handles mixed punctuation', () => {
    expect(categorySlug('Smoke Shop!')).toBe('smoke-shop');
  });
});

describe('stateCitySlug', () => {
  it('joins state and city with a dash', () => {
    expect(stateCitySlug('NY', 'Albany')).toBe('ny-albany');
  });
  it('lowercases state', () => {
    expect(stateCitySlug('Ny', 'Albany')).toBe('ny-albany');
  });
  it('throws on reserved root collision', () => {
    expect(() => stateCitySlug('ca', 'tegory')).not.toThrow(); // 'ca-tegory' != 'category'
    // Force a synthetic collision:
    expect(() => stateCitySlug('', 'category')).toThrow(/Reserved slug collision/);
  });
  it('slugifies multi-word states', () => {
    expect(stateCitySlug('New York', 'New York')).toBe('new-york-new-york');
  });
  it('slugifies New Jersey', () => {
    expect(stateCitySlug('New Jersey', 'Bayonne')).toBe('new-jersey-bayonne');
  });
});
