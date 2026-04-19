import { getSiteSettingsPublic } from '@/lib/server/get-site-settings';
import { siteUrl as getSiteOrigin } from '@/lib/server/site-url';

export async function LocalBusinessJsonLd(): Promise<React.JSX.Element> {
  const s = await getSiteSettingsPublic();
  const url = getSiteOrigin();
  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    '@id': `${url}/#business`,
    name: s.businessName,
    description: `Barbershop and men's grooming${s.city ? ` in ${s.city}` : ''}. Book online — your barber in your neighborhood.${s.region ? ` ${s.region}, South Africa.` : ''}`,
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
