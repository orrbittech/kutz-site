'use client';

import Image from 'next/image';
import { SwiperSlide } from 'swiper/react';

import { MarketingSwiper } from './marketing-swiper';

export type GallerySlide = {
  /** Stable key when slides come from the API */
  id?: string;
  src: string;
  alt: string;
};

type GalleryCarouselProps = {
  slides: readonly GallerySlide[];
};

export function GalleryCarousel({ slides }: GalleryCarouselProps): React.JSX.Element {
  return (
    <MarketingSwiper loop={slides.length > 1}>
      {slides.map((slide) => (
        <SwiperSlide key={slide.id ?? slide.src}>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-brand-cream/40">
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 85vw"
            />
          </div>
        </SwiperSlide>
      ))}
    </MarketingSwiper>
  );
}
