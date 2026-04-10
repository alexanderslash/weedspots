import { RESERVED_ROOT } from './constants';

export function citySlug(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function categorySlug(label: string): string {
  return String(label || 'other')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'other';
}

export function stateCitySlug(state: string, city: string): string {
  const s = citySlug(state);
  const c = citySlug(city);
  const slug = s && c ? `${s}-${c}` : c;
  if (RESERVED_ROOT.has(slug)) {
    throw new Error(`Reserved slug collision: ${slug}`);
  }
  return slug;
}
