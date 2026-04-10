// web/src/lib/ranking.test.ts
import { describe, it, expect } from 'vitest';
import { ratingTier, rankSort, getSponsored, getNonSponsored } from './ranking';

describe('ratingTier', () => {
  it('maps 5.0 to tier 5', () => { expect(ratingTier(5.0)).toBe(5); });
  it('maps 4.9 to tier 5', () => { expect(ratingTier(4.9)).toBe(5); });
  it('maps 4.5 to tier 4.5', () => { expect(ratingTier(4.5)).toBe(4.5); });
  it('maps 4.0 to tier 4', () => { expect(ratingTier(4.0)).toBe(4); });
  it('maps 3.5 to tier 3.5', () => { expect(ratingTier(3.5)).toBe(3.5); });
  it('floors low ratings', () => { expect(ratingTier(2.7)).toBe(2); });
  it('handles 0', () => { expect(ratingTier(0)).toBe(0); });
});

describe('rankSort', () => {
  it('sorts higher rating tier first', () => {
    const list = [
      { rating: 4.0, reviewCount: 1000, reviews: [] },
      { rating: 5.0, reviewCount: 10, reviews: [] },
    ];
    list.sort(rankSort);
    expect(list[0].rating).toBe(5.0);
  });

  it('breaks ties by review count', () => {
    const list = [
      { rating: 4.9, reviewCount: 50, reviews: [] },
      { rating: 4.9, reviewCount: 500, reviews: [] },
    ];
    list.sort(rankSort);
    expect(list[0].reviewCount).toBe(500);
  });

  it('breaks further ties by newest review date', () => {
    const list = [
      { rating: 4.9, reviewCount: 50, reviews: [{ date: '2025-01-01' }] },
      { rating: 4.9, reviewCount: 50, reviews: [{ date: '2026-01-01' }] },
    ];
    list.sort(rankSort);
    expect(list[0].reviews[0].date).toBe('2026-01-01');
  });
});

describe('getSponsored / getNonSponsored', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  const list = [
    { placeId: 'a', isSponsored: true,  sponsoredUntil: future },
    { placeId: 'b', isSponsored: true,  sponsoredUntil: past },
    { placeId: 'c', isSponsored: false, sponsoredUntil: null  },
    { placeId: 'd', isSponsored: true,  sponsoredUntil: future },
    { placeId: 'e', isSponsored: true,  sponsoredUntil: future },
    { placeId: 'f', isSponsored: true,  sponsoredUntil: future },
  ];

  it('returns only active sponsors, capped at 3', () => {
    const sp = getSponsored(list);
    expect(sp.length).toBe(3);
    expect(sp.map(s => s.placeId)).toEqual(['a', 'd', 'e']);
  });

  it('getNonSponsored excludes the chosen sponsors', () => {
    const ns = getNonSponsored(list);
    const ids = ns.map(b => b.placeId);
    expect(ids).toContain('b'); // expired sponsor counts as non-sponsored
    expect(ids).toContain('c');
    expect(ids).toContain('f'); // beyond the 3-cap counts as non-sponsored
    expect(ids).not.toContain('a');
  });
});
