import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AppChrome } from '@/components/app-chrome';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { getLocalePageMetadata } from '@/lib/server/locale-page-metadata';
import { BookingsView } from './bookings-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return getLocalePageMetadata(params, 'bookings', 'bookingsTitle', 'bookingsDescription');
}

export default async function BookingsPage(): Promise<React.JSX.Element> {
  const t = await getTranslations('bookingsPage');
  const tNav = await getTranslations('nav');

  return (
    <AppChrome>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 md:px-6"
      >
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">{t('schedulingEyebrow')}</p>
          <div className="mt-2 flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-3 md:gap-4">
            <h1 className="min-w-0 text-balance text-3xl font-semibold uppercase tracking-tight md:text-4xl">
              {t('pageTitle')}
            </h1>
            <Link
              href="/appointments"
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded border-2 border-foreground bg-transparent px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-brand-cream/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
              )}
            >
              {tNav('myAppointments')}
            </Link>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-foreground/75">{t('pageIntro')}</p>
        </div>
        <Suspense
          fallback={
            <div className="flex min-w-0 flex-col gap-8">
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <div className="h-48 rounded-xl border border-border/40 bg-brand-cream/40" />
                <div className="h-64 rounded-xl border border-border/40 bg-brand-cream/40" />
              </div>
              <div className="h-40 rounded-xl border border-border/40 bg-brand-cream/40" />
              <div className="h-32 rounded-xl border border-border/40 bg-brand-cream/35" />
            </div>
          }
        >
          <BookingsView />
        </Suspense>
      </main>
    </AppChrome>
  );
}
