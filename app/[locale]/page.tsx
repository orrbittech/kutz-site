import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { HeroAuthActions } from '@/components/marketing/hero-auth-actions';
import { GallerySection } from '@/components/marketing/gallery-section';
import { ServicesAccordion } from '@/components/marketing/services-accordion';
import { TeamSection } from '@/components/marketing/team-section';
import { AppChrome } from '@/components/app-chrome';
import { Reveal } from '@/components/reveal';
import { getSiteSettingsPublic } from '@/lib/server/get-site-settings';

const HERO_BG =
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1920&q=85';
const CONTACT_BG =
  'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1920&q=85';

const SERVICE_ORDER = [
  { key: 'classicCut' as const, priceCents: 450_00 },
  { key: 'skinFade' as const, priceCents: 550_00 },
  { key: 'beardSculpt' as const, priceCents: 300_00 },
  { key: 'hotTowel' as const, priceCents: 150_00 },
];

const sectionSnap = 'snap-start snap-always min-h-screen-below-header flex flex-col justify-center';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');
  const settings = await getSiteSettingsPublic();

  const zar = new Intl.NumberFormat(locale, { style: 'currency', currency: 'ZAR' });

  const accordionItems = SERVICE_ORDER.map(({ key, priceCents }) => ({
    name: t(`services.${key}.name`),
    priceLabel: zar.format(priceCents / 100),
    description: t(`services.${key}.description`),
  }));

  return (
    <AppChrome>
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Reveal>
          <section className={`relative ${sectionSnap} overflow-hidden text-white`}>
            <Image
              src={HERO_BG}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-black/55" aria-hidden />
            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-10 md:px-6">
              <div className="max-w-2xl space-y-6">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
                  {t('hero.eyebrow')}
                </p>
                <h1 className="text-4xl font-semibold uppercase leading-tight tracking-tight md:text-5xl">
                  {settings.businessName}
                  {t('hero.titleSuffix')}
                </h1>
                <p className="max-w-xl text-base text-white/90 md:text-lg">
                  {t('hero.body', { businessName: settings.businessName })}
                </p>
                <div className="flex flex-wrap gap-3">
                  <HeroAuthActions />
                </div>
              </div>
              <div className="mt-12 border-t border-white/20 pt-6 md:mt-16">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">{t('hero.sameDayLabel')}</p>
                <p className="mt-2 max-w-lg text-sm text-white/85">{t('hero.sameDayBody')}</p>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="services" className={`${sectionSnap} bg-brand-cream/80`}>
            <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 md:grid-cols-2 md:items-start md:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">{t('services.menuLabel')}</p>
                <h2 className="mt-3 text-3xl font-semibold uppercase tracking-tight text-foreground md:text-4xl">
                  {t('services.heading')}
                </h2>
                <p className="mt-4 max-w-xl text-sm text-foreground/80 md:text-base">{t('services.subheading')}</p>
              </div>
              <div className="min-w-0 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70">{t('services.featuredLabel')}</p>
                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <ServicesAccordion items={accordionItems} />
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="gallery" className={`${sectionSnap} bg-background`}>
            <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">{t('gallery.label')}</p>
                  <h2 className="mt-2 text-3xl font-semibold uppercase tracking-tight md:text-4xl">{t('gallery.heading')}</h2>
                </div>
                <p className="max-w-md text-sm text-foreground/75">{t('gallery.body')}</p>
              </div>
              <div className="mt-10">
                <GallerySection />
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className={`${sectionSnap} bg-brand-cream`}>
            <div className="mx-auto w-full max-w-4xl px-4 text-center md:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-foreground/70">{t('testimonial.label')}</p>
              <blockquote className="mt-4 text-2xl font-semibold uppercase leading-snug text-foreground md:text-3xl">
                {t('testimonial.quote')}
              </blockquote>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">
                {t('testimonial.attribution')}
              </p>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="team" className={`${sectionSnap} bg-background`}>
            <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">{t('team.label')}</p>
                  <h2 className="mt-2 text-3xl font-semibold uppercase tracking-tight md:text-4xl">{t('team.heading')}</h2>
                </div>
                <p className="max-w-md text-sm text-foreground/75">{t('team.body')}</p>
              </div>
              <TeamSection />
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="contact" className={`relative ${sectionSnap} overflow-hidden text-white`}>
            <Image src={CONTACT_BG} alt="" fill className="object-cover" sizes="100vw" />
            <div className="absolute inset-0 bg-black/60" aria-hidden />
            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 md:flex-row md:items-center md:justify-between md:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">{t('contact.label')}</p>
                <h2 className="mt-3 text-3xl font-semibold uppercase md:text-4xl">{t('contact.heading')}</h2>
                <p className="mt-3 max-w-xl text-sm text-white/85">{t('contact.body')}</p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3 md:mt-0">
                <Link href="/styles">
                  <Button variant="primary">{tNav('bookNow')}</Button>
                </Link>
                <Link href="/sign-up">
                  <Button variant="outline" className="border-white text-white hover:bg-white/10 focus-visible:ring-white/40">
                    {t('contact.getStarted')}
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button variant="outline" className="border-white text-white hover:bg-white/10 focus-visible:ring-white/40">
                    {tNav('signIn')}
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
    </AppChrome>
  );
}
