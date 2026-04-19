import { getSiteSettingsPublic } from '@/lib/server/get-site-settings';
import { ScrollChrome } from '@/components/scroll-chrome';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export async function AppChrome({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const s = await getSiteSettingsPublic();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader businessName={s.businessName} />
      <div className="flex flex-1 flex-col pt-[var(--header-height)]">
        <ScrollChrome>{children}</ScrollChrome>
      </div>
      <SiteFooter
        businessName={s.businessName}
        addressLine1={s.addressLine1}
        city={s.city}
        region={s.region}
        postalCode={s.postalCode}
        country={s.country}
        phone={s.phone}
        publicEmail={s.publicEmail}
        openingHours={s.openingHours}
      />
    </div>
  );
}
