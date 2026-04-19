import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppChrome } from '@/components/app-chrome';
import { getLocalePageMetadata } from '@/lib/server/locale-page-metadata';
import { BookingsView } from './bookings-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return getLocalePageMetadata(params, 'bookings', 'bookingsTitle', 'bookingsDescription');
}

export default function BookingsPage(): React.JSX.Element {
  return (
    <AppChrome>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 md:px-6"
      >
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">Scheduling</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold uppercase tracking-tight md:text-4xl">Bookings</h1>
          <p className="mt-3 max-w-2xl text-sm text-foreground/75">
            Choose a style from the menu first, then pick a time and add notes. Sign in when you are ready to finalize —
            your list updates as soon as you are signed in.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex min-w-0 flex-col gap-8">
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <div className="h-48 animate-pulse rounded-xl border border-border/40 bg-brand-cream/40" />
                <div className="h-64 animate-pulse rounded-xl border border-border/40 bg-brand-cream/40" />
              </div>
              <div className="h-40 animate-pulse rounded-xl border border-border/40 bg-brand-cream/40" />
              <div className="h-32 animate-pulse rounded-xl border border-border/40 bg-brand-cream/35" />
            </div>
          }
        >
          <BookingsView />
        </Suspense>
      </main>
    </AppChrome>
  );
}
