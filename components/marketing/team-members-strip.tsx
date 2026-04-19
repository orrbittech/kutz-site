'use client';

import Image from 'next/image';
import { UserRound } from 'lucide-react';
import { SwiperSlide } from 'swiper/react';
import type { TeamMemberResponse } from '@/lib/zod/team-member';
import { MarketingSwiper } from './marketing-swiper';

export function TeamMembersStrip({ members }: { members: TeamMemberResponse[] }): React.JSX.Element {
  return (
    <div className="mt-10 w-full min-w-0">
      <MarketingSwiper loop={members.length > 1}>
        {members.map((member) => (
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
