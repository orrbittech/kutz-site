import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AppChrome } from '@/components/app-chrome';
import { getLocalePageMetadata } from '@/lib/server/locale-page-metadata';
import { StylesView } from './styles-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return getLocalePageMetadata(params, 'styles', 'stylesTitle', 'stylesDescription');
}

export default async function StylesPage(): Promise<React.JSX.Element> {
  const t = await getTranslations('stylesPage');
  return (
    <AppChrome>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-6"
      >
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">{t('eyebrow')}</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold uppercase tracking-tight md:text-4xl">{t('title')}</h1>
          <p className="mt-3 max-w-2xl text-sm text-foreground/75">{t('description')}</p>
        </div>
        <StylesView />
      </main>
    </AppChrome>
  );
}
