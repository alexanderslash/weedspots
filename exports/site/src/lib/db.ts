import mongoose from 'mongoose';
import { categoryMeta, citySlug, effectiveCategory, CANNABIS_BROWSE_CATEGORIES } from './utils';

// ─── Mongoose models (mirrors models.js) ───────────────────────────────────
const BusinessSchema = new mongoose.Schema({}, { strict: false });
const Business =
  mongoose.models['Business'] ||
  mongoose.model('Business', BusinessSchema, 'businesses');

const PlaceRawSchema = new mongoose.Schema({}, { strict: false });
const PlaceRaw =
  mongoose.models['PlaceRaw'] ||
  mongoose.model('PlaceRaw', PlaceRawSchema, 'placeraws');

// ─── Types ──────────────────────────────────────────────────────────────────
export interface Review {
  author: string | null;
  rating: number | null;
  text: string | null;
  date: Date | null;
  relativeTime: string | null;
}

export interface Photo {
  name: string | null;
  widthPx: number | null;
  heightPx: number | null;
}

export interface OpeningHours {
  openNow: boolean | null;
  weekdayDescriptions: string[];
  periods: Array<{
    open: { day: number; hour: number; minute: number } | null;
    close: { day: number; hour: number; minute: number } | null;
  }>;
}

export interface BusinessDoc {
  placeId: string;
  name: string;
  slug: string;
  category: string;
  primaryGoogleCategory?: string;
  additionalGoogleCategories?: string[];
  seoDescription?: string;
  reviewHighlights?: string[];
  faqs?: { q: string; a: string }[];
  primaryType: string;
  googleMapsTypeLabel: string;
  formattedAddress: string;
  shortAddress: string;
  street: string;
  neighborhood: string;
  city: string;
  county: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
  phone: string;
  internationalPhone: string;
  website: string;
  googleMapsUri: string;
  googleMapsLinks: Record<string, string>;
  rating: number;
  reviewCount: number;
  reviews: Review[];
  photos: Photo[];
  openingHours: OpeningHours | null;
  businessStatus: string;
  pureServiceAreaBusiness: boolean;
  isSponsored: boolean;
  sponsoredUntil: Date | null;
  scrapedAt: Date;
  createdAt: Date;
  editorialSummary?: string;
  parkingOptions?: Record<string, boolean>;
  accessibilityOptions?: Record<string, boolean>;
  paymentOptions?: Record<string, boolean>;
}

// ─── Singleton data cache ───────────────────────────────────────────────────
let _cache: {
  businesses: BusinessDoc[];
  cityMap: Map<string, BusinessDoc[]>;
  categoryCounts: Record<string, number>;
} | null = null;

export async function getAllData() {
  if (_cache) return _cache;

  const uri = import.meta.env.MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  const raw = await Business.find({ businessStatus: 'OPERATIONAL' })
    .lean<BusinessDoc[]>();

  // Fetch extra fields from PlaceRaw and merge into businesses
  const placeRaws = await PlaceRaw.find({}).select('placeId data').lean() as any[];
  const placeRawMap = new Map<string, any>(placeRaws.map((r: any) => [r.placeId, r.data]));

  const businesses = (raw as BusinessDoc[]).map(b => {
    const rawData = placeRawMap.get(b.placeId) || {};
    return {
      ...b,
      // Use the most accurate cannabis category (from Google Maps scraper)
      category: effectiveCategory(b),
      editorialSummary: rawData.editorialSummary?.text || '',
      parkingOptions: rawData.parkingOptions || {},
      accessibilityOptions: rawData.accessibilityOptions || {},
      paymentOptions: rawData.paymentOptions || {},
    };
  });

  const cityMap = new Map<string, BusinessDoc[]>();
  for (const b of businesses) {
    const c = b.city || 'Unknown';
    if (!cityMap.has(c)) cityMap.set(c, []);
    cityMap.get(c)!.push(b);
  }

  // Only count cannabis-relevant categories for Browse by Category / category pages
  const categoryCounts: Record<string, number> = {};
  for (const b of businesses) {
    const cat = b.category;
    if (!CANNABIS_BROWSE_CATEGORIES.has(cat.toLowerCase())) continue;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  _cache = { businesses, cityMap, categoryCounts };
  return _cache;
}

export function getCitySlugMap(cityMap: Map<string, BusinessDoc[]>) {
  const map = new Map<string, string>();
  for (const city of cityMap.keys()) {
    map.set(citySlug(city), city);
  }
  return map;
}
