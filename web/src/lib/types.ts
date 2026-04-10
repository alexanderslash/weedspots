export interface Review {
  author: string | null;
  rating: number | null;
  text: string | null;
  date: string | null;
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

export interface Business {
  placeId: string;
  name: string;
  slug: string;
  category: string;
  primaryGoogleCategory?: string;
  additionalGoogleCategories?: string[];
  seoDescription?: string;
  reviewHighlights?: string[];
  faqs?: Array<{ q: string; a: string }>;
  formattedAddress: string;
  street: string;
  neighborhood?: string;
  city: string;
  county?: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
  phone: string;
  website: string;
  googleMapsUri: string;
  rating: number;
  reviewCount: number;
  reviews: Review[];
  photos: Photo[];
  openingHours: OpeningHours | null;
  businessStatus: string;
  isSponsored: boolean;
  sponsoredUntil: string | null;
  scrapedAt: string;
  createdAt: string;
  editorialSummary?: string;
  parkingOptions?: Record<string, boolean>;
  accessibilityOptions?: Record<string, boolean>;
  paymentOptions?: Record<string, boolean>;

  // Derived fields written by the import script:
  stateCitySlug: string | null;
  coverPhoto: string | null;
}

export interface CityAggregate {
  stateCitySlug: string;
  cityName: string;
  state: string;
  count: number;
  categoryCounts: Record<string, number>;
}

export interface CategoryAggregate {
  slug: string;
  display: string;
  count: number;
}

export interface SearchIndexEntry {
  slug: string;
  name: string;
  stateCitySlug: string | null;
  city: string;
  state: string;
  category: string;
  rating: number;
}
