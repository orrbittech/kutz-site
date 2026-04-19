import { Clock, Mail, MapPin, Phone, UserPlus, UserRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type SiteFooterProps = {
  businessName?: string;
  addressLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  publicEmail?: string;
  openingHours?: string[];
};

export async function SiteFooter({
  businessName = 'Kutz',
  addressLine1 = '',
  city = '',
  region = '',
  postalCode = '',
  country = '',
  phone = '',
  publicEmail = '',
  openingHours = [],
}: SiteFooterProps): Promise<React.JSX.Element> {
  const t = await getTranslations('footer');
  const year = new Date().getFullYear();

  const addressLine =
    [addressLine1, city, region, postalCode, country].filter(Boolean).join(', ') || t('addressFallback');
  const hoursDisplay = openingHours.length > 0 ? openingHours.join(' · ') : t('hoursFallback');

  return (
    <footer className="snap-start border-t border-border bg-brand-brown text-brand-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 md:flex-row md:items-start md:justify-between md:px-6">
        <div>
          <p className="text-lg font-semibold uppercase tracking-[0.3em]">{businessName}</p>
          <p className="mt-3 max-w-sm text-sm text-white/75">{t('tagline')}</p>
        </div>
        <div className="grid grid-cols-1 gap-8 text-sm sm:grid-cols-2 md:max-w-xl md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{t('about')}</p>
            {phone ? (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="text-white/90">{t('contactLabel', { phone })}</span>
              </p>
            ) : null}
            {publicEmail ? (
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <a href={`mailto:${publicEmail}`} className="text-white/90 underline underline-offset-2 hover:text-white">
                  {publicEmail}
                </a>
              </p>
            ) : null}
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="text-white/90">{hoursDisplay}</span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="text-white/90">{addressLine}</span>
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{t('accounts')}</p>
            <Link href="/sign-up" className="flex items-center gap-2 hover:text-white/90">
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
              {t('joinBrand', { businessName })}
            </Link>
            <Link href="/account" className="flex items-center gap-2 hover:text-white/90">
              <UserRound className="h-4 w-4 shrink-0" aria-hidden />
              {t('myAccount')}
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-6 text-center text-xs text-white/50 md:px-6">
        <p>{t('copyrightBusiness', { year, businessName })}</p>
        <p className="mx-auto mt-3 max-w-2xl leading-relaxed">
          {t('platformRights')}{' '}
          <a
            href="https://orrbit.co.za"
            className="font-medium text-white/70 underline underline-offset-4 hover:text-white/90"
          >
            {t('vendorName')}
          </a>
        </p>
      </div>
    </footer>
  );
}
