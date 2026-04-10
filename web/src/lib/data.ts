import businessesJson from '../data/businesses.json';
import citiesJson from '../data/cities.json';
import categoriesJson from '../data/categories.json';
import sponsorsJson from '../data-static/sponsors.json';
import type { Business, CityAggregate, CategoryAggregate } from './types';

interface AllData {
  businesses: Business[];
  cities: CityAggregate[];
  categories: CategoryAggregate[];
  byPlaceId: Map<string, Business>;
  bySlug: Map<string, Business>;
  byStateCity: Map<string, Business[]>;
}

let _cache: AllData | null = null;

export function getAllData(): AllData {
  if (_cache) return _cache;

  const sponsors = sponsorsJson as Record<string, { until: string }>;
  const now = Date.now();

  const businesses: Business[] = (businessesJson as Business[]).map(b => {
    const sponsor = sponsors[b.placeId];
    if (sponsor && new Date(sponsor.until).getTime() >= now) {
      return { ...b, isSponsored: true, sponsoredUntil: sponsor.until };
    }
    return { ...b, isSponsored: false, sponsoredUntil: null };
  });

  const byPlaceId = new Map<string, Business>();
  const bySlug = new Map<string, Business>();
  const byStateCity = new Map<string, Business[]>();

  for (const b of businesses) {
    byPlaceId.set(b.placeId, b);
    bySlug.set(b.slug, b);
    if (b.stateCitySlug) {
      const arr = byStateCity.get(b.stateCitySlug) || [];
      arr.push(b);
      byStateCity.set(b.stateCitySlug, arr);
    }
  }

  _cache = {
    businesses,
    cities: citiesJson as unknown as CityAggregate[],
    categories: categoriesJson as unknown as CategoryAggregate[],
    byPlaceId,
    bySlug,
    byStateCity,
  };
  return _cache;
}
