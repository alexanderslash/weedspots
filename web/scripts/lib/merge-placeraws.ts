import type { Business } from '../../src/lib/types';

interface PlaceRaw {
  placeId: string;
  data?: {
    editorialSummary?: { text?: string };
    parkingOptions?: Record<string, boolean>;
    accessibilityOptions?: Record<string, boolean>;
    paymentOptions?: Record<string, boolean>;
  };
}

/** Attach editorialSummary + options from placeraws onto each business. */
export function mergePlaceRaws(
  businesses: Business[],
  placeRaws: PlaceRaw[],
): Business[] {
  const map = new Map<string, PlaceRaw['data']>();
  for (const r of placeRaws) map.set(r.placeId, r.data || {});

  return businesses.map(b => {
    const data = map.get(b.placeId) || {};
    return {
      ...b,
      editorialSummary: data.editorialSummary?.text || '',
      parkingOptions: data.parkingOptions || {},
      accessibilityOptions: data.accessibilityOptions || {},
      paymentOptions: data.paymentOptions || {},
    };
  });
}
