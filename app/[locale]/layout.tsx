import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AppProviders } from '../providers';
import { LocalBusinessJsonLd } from '@/components/seo/local-business-json-ld';
import { ThemeStyleTag } from '@/components/theme-style-tag';
import { routing, type AppLocale } from '@/i18n/routing';
import { getSiteSettingsPublic } from '@/lib/server/get-site-settings';
import { siteUrl } from '@/lib/server/site-url';

function isAppLocale(locale: string): locale is AppLocale {
  return (routing.locales as readonly string[]).includes(locale);
}

function openGraphLocaleTag(_locale: AppLocale): string {
  return 'en_US';
}

export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'meta' });
  const s = await getSiteSettingsPublic();
  const suffix = s.city
    ? t('suffixCity', { city: s.city, region: s.region ? `, ${s.region}` : '' })
    : t('suffixEmpty');
  const title = t('title', { businessName: s.businessName });
  const description = t('description', { businessName: s.businessName, suffix });
  const keywords = (t.raw('keywords') as string[]).concat(
    [s.city, s.region, s.businessName].filter((x): x is string => Boolean(x)),
  );

  const base = siteUrl();
  const pathPrefix = `/${locale}`;
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}`])) as Record<
    AppLocale,
    string
  >;

  const linkedInAuthor = 'https://www.linkedin.com/in/brandonnkawu/';

  return {
    metadataBase: new URL(base),
    title: { default: title, template: `%s | ${s.businessName}` },
    description,
    keywords,
    authors: [{ name: 'Brandon N Nkawu', url: linkedInAuthor }],
    creator: 'Brandon N Nkawu',
    publisher: 'Orrbit Technologies',
    alternates: {
      canonical: pathPrefix,
      languages,
    },
    openGraph: {
      title,
      description,
      url: `${base}${pathPrefix}`,
      siteName: s.businessName,
      locale: openGraphLocaleTag(locale),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'common' });

  return (
    <>
      <a href="#main-content" className="skip-link">
        {t('skipToMain')}
      </a>
      <ThemeStyleTag />
      <LocalBusinessJsonLd />
      <NextIntlClientProvider messages={messages}>
        <AppProviders>{children}</AppProviders>
      </NextIntlClientProvider>
    </>
  );
}
