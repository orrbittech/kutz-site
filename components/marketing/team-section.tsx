'use client';

import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SwiperSlide } from 'swiper/react';
import { Card } from '@/components/ui/card';
import { queryKeys } from '@/lib/api/query-keys';
import { publicFetch } from '@/lib/api/public-fetch';
import { teamMemberListSchema } from '@/lib/zod/team-member';
import { MarketingSwiper } from './marketing-swiper';

export function TeamSection(): React.JSX.Element {
  const t = useTranslations('home.team');

  const query = useQuery({
    queryKey: queryKeys.teamMembers,
    queryFn: async () => {
      const raw = await publicFetch<unknown>('/team-members');
      return teamMemberListSchema.parse(raw);
    },
  });

  if (query.isPending) {
    return (
      <div
        className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-busy="true"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col">
            <div className="relative aspect-[3/4] animate-pulse overflow-hidden rounded-lg border border-border bg-brand-cream/50" />
            <div className="mt-3 space-y-2 px-1">
              <div className="mx-auto h-3.5 w-2/5 rounded bg-brand-cream/55" />
              <div className="mx-auto h-3 w-3/5 rounded bg-brand-cream/45" />
            </div>
          </div>
        ))}
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

  return (
    <div className="mt-10 w-full min-w-0">
      <MarketingSwiper loop={items.length > 1}>
        {items.map((member) => (
          <SwiperSlide key={member.id}>
            <div className="flex flex-col">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-brand-cream/40">
                {member.imageUrl ? (
                  <Image
                    src={member.imageUrl}
                    alt={member.name}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 85vw"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-foreground/30">
                    <UserRound className="h-16 w-16" aria-hidden />
                  </span>
                )}
              </div>
              <div className="mt-3 px-1 text-center">
                <p className="text-sm font-semibold uppercase tracking-wide text-foreground">{member.name}</p>
                <p className="mt-1 text-xs text-foreground/65">{member.role}</p>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </MarketingSwiper>
    </div>
  );
}
