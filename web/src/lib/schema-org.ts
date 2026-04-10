const SITE_URL = (import.meta as any).env?.SITE_URL || process.env.SITE_URL || 'https://weedspots.io';

export function localBusinessSchema(b: {
  name: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  lat?: number;
  lng?: number;
}): string {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: b.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.street || '',
      addressLocality: b.city || '',
      addressRegion: b.state || '',
      addressCountry: 'US',
      postalCode: b.postalCode || '',
    },
  };
  if (b.phone) schema.telephone = b.phone;
  if (b.website) schema.url = b.website;
  if (b.rating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: b.rating,
      reviewCount: b.reviewCount || 0,
    };
  }
  if (b.lat && b.lng) {
    schema.geo = { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng };
  }
  return JSON.stringify(schema);
}

export function itemListSchema(
  title: string,
  items: Array<{ name: string; slug: string }>,
): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: { '@type': 'LocalBusiness', name: item.name, url: `${SITE_URL}/listing/${item.slug}/` },
    })),
  });
}

export function faqSchema(faqs: Array<{ q: string; a: string }>): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });
}

export function breadcrumbSchema(crumbs: Array<{ name: string; url?: string }>): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: `${SITE_URL}${c.url}` } : {}),
    })),
  });
}
