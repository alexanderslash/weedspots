import type { Business, CityAggregate, CategoryAggregate, SearchIndexEntry } from '../../src/lib/types';
import { CANNABIS_BROWSE_CATEGORIES } from '../../src/lib/constants';
import { categorySlug } from '../../src/lib/slugs';

export function buildCities(businesses: Business[]): CityAggregate[] {
  const byCity = new Map<string, CityAggregate>();
  for (const b of businesses) {
    if (!b.stateCitySlug) continue;
    let entry = byCity.get(b.stateCitySlug);
    if (!entry) {
      entry = {
        stateCitySlug: b.stateCitySlug,
        cityName: b.city,
        state: b.state,
        count: 0,
        categoryCounts: {},
      };
      byCity.set(b.stateCitySlug, entry);
    }
    entry.count++;
    const cat = b.category;
    entry.categoryCounts[cat] = (entry.categoryCounts[cat] || 0) + 1;
  }
  return [...byCity.values()].sort((a, b) => b.count - a.count);
}

export function buildCategories(businesses: Business[]): CategoryAggregate[] {
  const counts = new Map<string, number>();
  for (const b of businesses) {
    const cat = (b.category || '').trim();
    if (!cat) continue;
    if (!CANNABIS_BROWSE_CATEGORIES.has(cat.toLowerCase())) continue;
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([display, count]) => ({ display, slug: categorySlug(display), count }))
    .sort((a, b) => b.count - a.count);
}

export function buildSearchIndex(businesses: Business[]): SearchIndexEntry[] {
  return businesses.map(b => ({
    slug: b.slug,
    name: b.name,
    stateCitySlug: b.stateCitySlug,
    city: b.city,
    state: b.state,
    category: b.category,
    rating: b.rating || 0,
  }));
}
