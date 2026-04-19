import { cache } from 'react';
import { gallerySlideListSchema, type GallerySlideResponse } from '@/lib/zod/gallery-slide';
import { teamMemberListSchema, type TeamMemberResponse } from '@/lib/zod/team-member';

function apiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  return base.replace(/\/$/, '');
}

export type MarketingListResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; data: [] };

export const getGallerySlidesPublic = cache(async function getGallerySlidesPublic(): Promise<
  MarketingListResult<GallerySlideResponse>
> {
  const base = apiBase();
  if (!base) {
    return { ok: true, data: [] };
  }
  try {
    const res = await fetch(`${base}/api/v1/gallery-slides`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return { ok: false, data: [] };
    }
    const json: unknown = await res.json();
    return { ok: true, data: gallerySlideListSchema.parse(json) };
  } catch {
    return { ok: false, data: [] };
  }
});

export const getTeamMembersPublic = cache(async function getTeamMembersPublic(): Promise<
  MarketingListResult<TeamMemberResponse>
> {
  const base = apiBase();
  if (!base) {
    return { ok: true, data: [] };
  }
  try {
    const res = await fetch(`${base}/api/v1/team-members`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return { ok: false, data: [] };
    }
    const json: unknown = await res.json();
    return { ok: true, data: teamMemberListSchema.parse(json) };
  } catch {
    return { ok: false, data: [] };
  }
});
