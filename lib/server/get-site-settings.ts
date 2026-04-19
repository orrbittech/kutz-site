import { cache } from 'react';
import { siteSettingsPublicSchema, defaultSiteSettingsPublic, type SiteSettingsPublic } from '@/lib/zod/site-settings';

function apiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  return base.replace(/\/$/, '');
}

export const getSiteSettingsPublic = cache(async function getSiteSettingsPublic(): Promise<SiteSettingsPublic> {
  const base = apiBase();
  if (!base) {
    return defaultSiteSettingsPublic;
  }
  try {
    const res = await fetch(`${base}/api/v1/public/site-settings`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return defaultSiteSettingsPublic;
    }
    const json: unknown = await res.json();
    return siteSettingsPublicSchema.parse(json);
  } catch {
    return defaultSiteSettingsPublic;
  }
});
