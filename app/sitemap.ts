import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { siteUrl } from '@/lib/server/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();
  const paths = ['', '/sign-in', '/sign-up', '/styles', '/bookings', '/appointments', '/account'];
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of routing.locales) {
    for (const path of paths) {
      const urlPath = path === '' ? `/${locale}` : `/${locale}${path}`;
      const priority =
        path === ''
          ? 1
          : path === '/styles' || path === '/bookings' || path === '/appointments'
            ? 0.85
            : 0.65;
      entries.push({
        url: `${base}${urlPath}`,
        lastModified,
        changeFrequency: path === '' ? 'weekly' : 'monthly',
        priority,
      });
    }
  }
  return entries;
}
