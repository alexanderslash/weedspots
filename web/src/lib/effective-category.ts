import { CANNABIS_BROWSE_CATEGORIES } from './constants';

export function effectiveCategory(b: {
  primaryGoogleCategory?: string;
  additionalGoogleCategories?: string[];
  category?: string;
}): string {
  const primary = (b.primaryGoogleCategory || '').trim();
  if (primary && CANNABIS_BROWSE_CATEGORIES.has(primary.toLowerCase())) return primary;

  const cannabisAdditional = (b.additionalGoogleCategories || [])
    .map(c => c.trim())
    .find(c => CANNABIS_BROWSE_CATEGORIES.has(c.toLowerCase()));
  if (cannabisAdditional) return cannabisAdditional;

  return primary || b.category || 'Other';
}
