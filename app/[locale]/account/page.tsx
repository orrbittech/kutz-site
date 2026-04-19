import type { Metadata } from 'next';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { getTranslations } from 'next-intl/server';
import { Calendar, ShoppingBag } from 'lucide-react';
import { AppChrome } from '@/components/app-chrome';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { getLocalePageMetadata } from '@/lib/server/locale-page-metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return getLocalePageMetadata(params, 'account', 'accountTitle', 'accountDescription');
}

export default async function AccountPage(): Promise<React.JSX.Element> {
  const t = await getTranslations('nav');
  const tAccount = await getTranslations('accountPage');

  return (
    <AppChrome>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 md:px-6"
      >
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">{t('account')}</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold uppercase tracking-tight md:text-4xl">
            {t('account')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-foreground/75">{tAccount('intro')}</p>
        </div>

        <SignedIn>
          <nav aria-label="Account sections" className="grid gap-4">
            <Link
              href="/appointments"
              className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Card className="flex h-full min-h-[120px] flex-col gap-3 p-6 transition hover:shadow-md">
                <Calendar className="h-8 w-8 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide">{t('myAppointments')}</p>
                  <p className="mt-1 text-xs text-foreground/70">{tAccount('appointmentsCardSubtitle')}</p>
                </div>
              </Card>
            </Link>
            <Link href="/orders" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Card className="flex h-full min-h-[120px] flex-col gap-3 p-6 transition hover:shadow-md sm:flex-row sm:items-center sm:gap-6">
                <ShoppingBag className="h-8 w-8 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide">{t('orders')}</p>
                  <p className="mt-1 text-xs text-foreground/70">View purchase history</p>
                </div>
              </Card>
            </Link>
          </nav>
        </SignedIn>

        <SignedOut>
          <Card className="mt-8 space-y-4 p-6 text-sm text-foreground/80">
            <p>{tAccount('signInBlurb')}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-in">
                <Button variant="primary">{t('signIn')}</Button>
              </Link>
              <Link href="/sign-up">
                <Button variant="outline">{t('createAccount')}</Button>
              </Link>
            </div>
          </Card>
        </SignedOut>
      </main>
    </AppChrome>
  );
}
