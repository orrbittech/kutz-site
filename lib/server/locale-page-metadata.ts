import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { routing, type AppLocale } from '@/i18n/routing';
import { HERO_BG } from '@/lib/marketing/hero-assets';
import { getSiteSettingsPublic } from '@/lib/server/get-site-settings';
import { getLocalizedMetaSuffix } from '@/lib/server/meta-suffix';
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
function openGraphLocaleTag(_locale: AppLocale): string {
  return 'en_US';
}

/** Home route: barber-first title/description, canonical, and social preview image. */
export async function getHomePageMetadata(params: Promise<{ locale: string }>): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'meta' });
  const s = await getSiteSettingsPublic();
  const suffix = await getLocalizedMetaSuffix(locale);
  const title = t('homeTitle', { businessName: s.businessName });
  const description = t('homeDescription', { businessName: s.businessName, suffix });
  const base = siteUrl();
  const pathPrefix = `/${locale}`;
  return {
    title,
    description,
    alternates: { canonical: pathPrefix },
    openGraph: {
      title,
      description,
      url: `${base}${pathPrefix}`,
      siteName: s.businessName,
      locale: openGraphLocaleTag(locale),
      type: 'website',
      images: [{ url: HERO_BG, width: 1920, height: 1280, alt: s.businessName }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [HERO_BG],
    },
  };
}

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
