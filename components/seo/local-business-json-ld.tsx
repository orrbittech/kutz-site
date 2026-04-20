import { getSiteSettingsPublic } from '@/lib/server/get-site-settings';
import { siteUrl as getSiteOrigin } from '@/lib/server/site-url';

export async function LocalBusinessJsonLd(): Promise<React.JSX.Element> {
  const s = await getSiteSettingsPublic();
  const url = getSiteOrigin();

  const locality =
    s.city && s.region
      ? `${s.city}, ${s.region}`
      : s.city
        ? s.city
        : s.region
          ? s.region
          : '';

  const localityPhrase = locality
    ? ` Serving clients in ${locality}${s.country ? `, ${s.country}` : ''}.`
    : s.country
      ? ` Serving ${s.country}.`
      : '';

  const description = `${s.businessName} is a neighborhood barbershop focused on men's grooming — haircuts, skin fades, lineups, and beard shaping with clear pricing and online booking.${localityPhrase}`;

  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['BarberShop', 'HairSalon'],
    '@id': `${url}/#business`,
    name: s.businessName,
    description,
    knowsAbout: ["Men's haircut", 'Skin fade', 'Beard trim and shape', 'Lineup', 'Hot towel finish'],
    url,
    telephone: s.phone || undefined,
    email: s.publicEmail || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.addressLine1 || undefined,
      addressLocality: s.city || undefined,
      addressRegion: s.region || undefined,
      postalCode: s.postalCode || undefined,
      addressCountry: s.country || undefined,
    },
    priceRange: '$$',
  };

  if (s.openingHours.length > 0) {
    payload.openingHours = s.openingHours;
  }

  if (s.latitude != null && s.longitude != null) {
    payload.geo = {
      '@type': 'GeoCoordinates',
      latitude: s.latitude,
      longitude: s.longitude,
    };
  }

  payload.areaServed = s.city
    ? {
        '@type': 'City',
        name: s.city,
      }
    : undefined;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
