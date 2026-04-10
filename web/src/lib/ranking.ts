import { MAX_SPONSORED } from './constants';

export function ratingTier(r: number): number {
  if (r >= 4.9) return 5;
  if (r >= 4.4) return 4.5;
  if (r >= 3.9) return 4;
  if (r >= 3.4) return 3.5;
  return Math.floor(r);
}

function newestReviewTs(b: { reviews?: Array<{ date?: string | null }> }): number {
  const reviews = b.reviews || [];
  if (!reviews.length) return 0;
  return Math.max(...reviews.map(r => (r.date ? new Date(r.date).getTime() : 0)));
}

export function rankSort(
  a: { rating?: number; reviewCount?: number; reviews?: Array<{ date?: string | null }> },
  b: { rating?: number; reviewCount?: number; reviews?: Array<{ date?: string | null }> },
): number {
  const tierDiff = ratingTier(b.rating || 0) - ratingTier(a.rating || 0);
  if (tierDiff !== 0) return tierDiff;
  const countDiff = (b.reviewCount || 0) - (a.reviewCount || 0);
  if (countDiff !== 0) return countDiff;
  return newestReviewTs(b) - newestReviewTs(a);
}

export function getSponsored<T extends { isSponsored?: boolean; sponsoredUntil?: string | null }>(
  businesses: T[],
): T[] {
  const now = Date.now();
  return businesses
    .filter(b => b.isSponsored && b.sponsoredUntil && new Date(b.sponsoredUntil).getTime() >= now)
    .slice(0, MAX_SPONSORED);
}

export function getNonSponsored<T extends { placeId: string; isSponsored?: boolean; sponsoredUntil?: string | null }>(
  businesses: T[],
): T[] {
  const sponsoredIds = new Set(getSponsored(businesses).map(b => b.placeId));
  return businesses.filter(b => !sponsoredIds.has(b.placeId));
}
