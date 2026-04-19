import { cache } from 'react';
import { styleListSchema, type StyleResponse } from '@/lib/zod/style';

function apiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  return base.replace(/\/$/, '');
}

/** Server-only fetch for the public styles catalog (avoids BFF /api/v1 proxy). */
export const getStylesListPublic = cache(async function getStylesListPublic(): Promise<
  StyleResponse[] | null
> {
  const base = apiBase();
  if (!base) {
    return null;
  }
  try {
    const res = await fetch(`${base}/api/v1/styles`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return null;
    }
    const json: unknown = await res.json();
    return styleListSchema.parse(json);
  } catch {
    return null;
  }
});
