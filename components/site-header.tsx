'use client';

import { SignedIn, SignedOut, SignOutButton, useAuth, useClerk, useUser } from '@clerk/nextjs';
import { Menu, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui-store';

type SiteHeaderProps = {
  businessName?: string;
};

function ProfileAvatarButton({
  ariaLabel,
  variant = 'default',
}: {
  ariaLabel: string;
  variant?: 'default' | 'overlay';
}): React.JSX.Element | null {
  const { openUserProfile } = useClerk();
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) return null;

  const src = user.imageUrl;
  const initial = (
    user.firstName?.charAt(0) ||
    user.primaryEmailAddress?.emailAddress?.charAt(0) ||
    '?'
  ).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => openUserProfile()}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        variant === 'overlay'
          ? 'border border-white/40 bg-white/10 text-white focus-visible:ring-white'
          : 'border border-border bg-muted text-foreground focus-visible:ring-primary',
      )}
      aria-label={ariaLabel}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" width={36} height={36} />
      ) : (
        <span className="text-xs font-semibold uppercase">{initial}</span>
      )}
    </button>
  );
}

export function SiteHeader({ businessName = 'Kutz' }: SiteHeaderProps): React.JSX.Element {
  const { mobileNavOpen, setMobileNavOpen, toggleMobileNav } = useUiStore();
  const { isLoaded: authLoaded } = useAuth();
  const locale = useLocale();
  const t = useTranslations('nav');

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background text-foreground">
      <div className="mx-auto flex h-[var(--header-height)] max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="text-lg font-semibold uppercase tracking-[0.25em]">
          {businessName}
        </Link>
        <nav className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.18em] md:flex">
          <Link href="/#services" className="hover:text-muted">
            {t('services')}
          </Link>
          <Link href="/#gallery" className="hover:text-muted">
            {t('gallery')}
          </Link>
          <Link href="/#team" className="hover:text-muted">
            {t('team')}
          </Link>
          <Link href="/styles" className="hover:text-muted">
            {t('styles')}
          </Link>
          {authLoaded ? (
            <>
              <SignedOut>
                <Link href="/#contact" className="hover:text-muted">
                  {t('contact')}
                </Link>
                <Link href="/styles" className="hover:text-muted">
                  {t('bookings')}
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/account" className="hover:text-muted">
                  {t('profile')}
                </Link>
              </SignedIn>
            </>
          ) : (
            <span className="hidden md:inline-flex md:min-h-[1em] md:min-w-[10rem]" aria-hidden />
          )}
        </nav>
        <div className="flex min-h-9 items-center gap-3">
          {authLoaded ? (
            <>
              <SignedOut>
                <Link href="/sign-in" className="hidden text-xs font-semibold uppercase tracking-wide md:inline">
                  {t('signIn')}
                </Link>
                <Link href="/sign-up">
                  <Button variant="primary" className="hidden md:inline-flex">
                    {t('bookNow')}
                  </Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center gap-2">
                  <div className="hidden md:block">
                    <ProfileAvatarButton ariaLabel={t('profile')} />
                  </div>
                  <SignOutButton redirectUrl={`/${locale}`}>
                    <button
                      type="button"
                      className="rounded-md border border-red-600 bg-red-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-red-600 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                      {t('signOut')}
                    </button>
                  </SignOutButton>
                </div>
              </SignedIn>
            </>
          ) : (
            <span className="hidden min-w-[5rem] md:inline-block" aria-hidden />
          )}
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border p-2 md:hidden"
            onClick={() => toggleMobileNav()}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-panel"
            aria-label={t('menu')}
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </div>
      <div
        id="mobile-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileNavOpen}
        className={cn(
          'fixed inset-0 z-[100] flex min-h-[100dvh] w-full flex-col bg-black text-white md:hidden',
          mobileNavOpen ? 'flex' : 'hidden',
        )}
      >
        <div className="flex shrink-0 items-center justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-white/30 p-2 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            onClick={() => setMobileNavOpen(false)}
            aria-label={t('closeMenu')}
          >
            <X className="h-6 w-6" aria-hidden />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-sm font-semibold uppercase tracking-wide">
          {authLoaded ? (
            <SignedIn>
              <div className="flex justify-center border-b border-white/20 pb-6">
                <ProfileAvatarButton ariaLabel={t('profile')} variant="overlay" />
              </div>
            </SignedIn>
          ) : (
            <div className="min-h-0 w-full max-w-sm" aria-hidden />
          )}
          <nav className="flex w-full max-w-sm flex-col items-center gap-5">
            <Link
              href="/#services"
              onClick={() => setMobileNavOpen(false)}
              className="text-white hover:text-white/80"
            >
              {t('services')}
            </Link>
            <Link
              href="/#gallery"
              onClick={() => setMobileNavOpen(false)}
              className="text-white hover:text-white/80"
            >
              {t('gallery')}
            </Link>
            <Link
              href="/#team"
              onClick={() => setMobileNavOpen(false)}
              className="text-white hover:text-white/80"
            >
              {t('team')}
            </Link>
            <Link
              href="/styles"
              onClick={() => setMobileNavOpen(false)}
              className="text-white hover:text-white/80"
            >
              {t('styles')}
            </Link>
            {authLoaded ? (
              <>
                <SignedOut>
                  <Link
                    href="/#contact"
                    onClick={() => setMobileNavOpen(false)}
                    className="text-white hover:text-white/80"
                  >
                    {t('contact')}
                  </Link>
                  <Link
                    href="/styles"
                    onClick={() => setMobileNavOpen(false)}
                    className="text-white hover:text-white/80"
                  >
                    {t('bookings')}
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link
                    href="/account"
                    onClick={() => setMobileNavOpen(false)}
                    className="text-white hover:text-white/80"
                  >
                    {t('profile')}
                  </Link>
                </SignedIn>
                <SignedOut>
                  <Link href="/sign-in" onClick={() => setMobileNavOpen(false)} className="text-white hover:text-white/80">
                    {t('signIn')}
                  </Link>
                  <Link href="/sign-up" onClick={() => setMobileNavOpen(false)} className="text-white hover:text-white/80">
                    {t('createAccount')}
                  </Link>
                </SignedOut>
              </>
            ) : (
              <span className="min-h-24 w-full max-w-sm" aria-hidden />
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
