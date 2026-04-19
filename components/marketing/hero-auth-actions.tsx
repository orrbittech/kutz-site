'use client';

import { SignedIn, SignedOut, useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export function HeroAuthActions(): React.JSX.Element {
  const { isLoaded } = useAuth();
  const t = useTranslations('home');

  if (!isLoaded) {
    return <div className="min-h-10 w-full max-w-md" aria-hidden />;
  }

  return (
    <>
      <SignedOut>
        <Link href="/styles">
          <Button
            variant="primary"
            className="border border-white bg-white text-black hover:bg-neutral-100 focus-visible:ring-white/60"
          >
            {t('hero.bookAppointment')}
          </Button>
        </Link>
        <Link href="/styles">
          <Button
            variant="outline"
            className="border-white text-white hover:bg-white/10 focus-visible:ring-white/40"
          >
            {t('hero.browseStyles')}
          </Button>
        </Link>
        <Link href="/sign-in">
          <Button
            variant="outline"
            className="border-white text-white hover:bg-white/10 focus-visible:ring-white/40"
          >
            {t('hero.returningClient')}
          </Button>
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href="/styles">
          <Button variant="primary">{t('hero.browseStyles')}</Button>
        </Link>
        <Link href="/bookings">
          <Button
            variant="outline"
            className="border-white text-white hover:bg-white/10 focus-visible:ring-white/40"
          >
            {t('hero.yourBookings')}
          </Button>
        </Link>
      </SignedIn>
    </>
  );
}
