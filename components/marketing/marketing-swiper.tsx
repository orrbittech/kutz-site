'use client';

import type { ReactNode } from 'react';
import { Swiper } from 'swiper/react';
import { Autoplay } from 'swiper/modules';

import 'swiper/css';

type MarketingSwiperProps = {
  /** When false, disables loop (e.g. a single slide). */
  loop: boolean;
  children: ReactNode;
};

/**
 * Shared horizontal Swiper for marketing strips (gallery, team): auto-play, loops, 1–3 slides per breakpoint.
 */
export function MarketingSwiper({ loop, children }: MarketingSwiperProps): React.JSX.Element {
  return (
    <Swiper
      modules={[Autoplay]}
      slidesPerView={1.15}
      spaceBetween={16}
      loop={loop}
      speed={600}
      autoplay={{
        delay: 5000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      }}
      breakpoints={{
        640: { slidesPerView: 2, spaceBetween: 16 },
        1024: { slidesPerView: 3, spaceBetween: 20 },
      }}
      className="w-full min-w-0"
    >
      {children}
    </Swiper>
  );
}
