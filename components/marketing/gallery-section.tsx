import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { GalleryCarousel } from '@/components/marketing/gallery-carousel';
import { getGallerySlidesPublic } from '@/lib/server/get-marketing-public';

export async function GallerySection(): Promise<React.JSX.Element> {
  const t = await getTranslations('home.gallery');
  const result = await getGallerySlidesPublic();

  if (!result.ok) {
    return (
      <Card className="mx-auto mt-10 max-w-md border-red-200 bg-red-50 text-sm text-red-900">
        {t('loadError')} {t('errorUnknown')}
      </Card>
    );
  }

  const items = result.data;
  if (items.length === 0) {
    return (
      <Card className="mx-auto mt-10 max-w-md text-sm text-foreground/80">
        {t('empty')}
      </Card>
    );
  }

  const slides = items.map((slide) => ({
    id: slide.id,
    src: slide.imageUrl,
    alt: slide.alt,
  }));

  return (
    <div className="mt-10 w-full min-w-0">
      <GalleryCarousel slides={slides} />
    </div>
  );
}
