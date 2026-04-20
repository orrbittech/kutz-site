import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { getSiteSettingsPublic } from '@/lib/server/get-site-settings';

/** Locality phrase appended to meta descriptions (city/region from site settings). */
export async function getLocalizedMetaSuffix(locale: AppLocale): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  const s = await getSiteSettingsPublic();
  return s.city
    ? t('suffixCity', { city: s.city, region: s.region ? `, ${s.region}` : '' })
    : t('suffixEmpty');
}
