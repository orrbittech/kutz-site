import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { routing, type AppLocale } from '@/i18n/routing';
import { getSiteSettingsPublic } from '@/lib/server/get-site-settings';
import { siteUrl } from '@/lib/server/site-url';

function isAppLocale(locale: string): locale is AppLocale {
  return (routing.locales as readonly string[]).includes(locale);
}

type PageMetaTitleKey =
  | 'stylesTitle'
  | 'bookingsTitle'
  | 'appointmentsTitle'
  | 'accountTitle'
  | 'ordersTitle';

type PageMetaDescriptionKey =
  | 'stylesDescription'
  | 'bookingsDescription'
  | 'appointmentsDescription'
  | 'accountDescription'
  | 'ordersDescription';

/**
 * Per-route title/description/canonical for App Router pages under `[locale]`.
 */
export async function getLocalePageMetadata(
  params: Promise<{ locale: string }>,
  pathSegment: string,
  titleKey: PageMetaTitleKey,
  descriptionKey: PageMetaDescriptionKey,
): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'pageMeta' });
  const s = await getSiteSettingsPublic();
  const title = t(titleKey);
  const description = t(descriptionKey, { businessName: s.businessName });
  const base = siteUrl();
  const path = `/${locale}/${pathSegment}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: `${base}${path}`,
      siteName: s.businessName,
      type: 'website',
    },
  };
}
