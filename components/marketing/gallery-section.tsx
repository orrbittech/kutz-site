'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { queryKeys } from '@/lib/api/query-keys';
import { publicFetch } from '@/lib/api/public-fetch';
import { gallerySlideListSchema } from '@/lib/zod/gallery-slide';
import { GalleryCarousel } from './gallery-carousel';

export function GallerySection(): React.JSX.Element {
  const t = useTranslations('home.gallery');

  const query = useQuery({
    queryKey: queryKeys.gallerySlides,
    queryFn: async () => {
      const raw = await publicFetch<unknown>('/gallery-slides');
      return gallerySlideListSchema.parse(raw);
    },
  });

  if (query.isPending) {
    return (
      <div className="mt-10 w-full min-w-0" aria-busy="true">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="relative aspect-[4/3] animate-pulse overflow-hidden rounded-lg border border-border bg-brand-cream/60" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card className="mx-auto mt-10 max-w-md border-red-200 bg-red-50 text-sm text-red-900">
        {t('loadError')}{' '}
        {query.error instanceof Error ? query.error.message : t('errorUnknown')}
      </Card>
    );
  }

  const items = query.data ?? [];
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
