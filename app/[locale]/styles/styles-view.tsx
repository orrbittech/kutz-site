'use client';

import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/api/query-keys';
import { publicFetch } from '@/lib/api/public-fetch';
import { STYLE_CATEGORY_ORDER, type StyleCategory } from '@/lib/constants/style-categories';
import { styleListSchema, type StyleResponse } from '@/lib/zod/style';

type CategoryFilter = 'all' | StyleCategory;

const STYLES_STALE_MS = 120_000;

export type StylesViewProps = {
  /** From RSC fetch; when set, first paint skips the BFF. Omit or null to load via client only. */
  initialStyles?: StyleResponse[] | null;
};

export function StylesView({ initialStyles }: StylesViewProps): React.JSX.Element {
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations('stylesCatalog');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const query = useQuery({
    queryKey: queryKeys.styles,
    queryFn: async () => {
      const raw = await publicFetch<unknown>('/styles');
      return styleListSchema.parse(raw);
    },
    staleTime: STYLES_STALE_MS,
    ...(initialStyles != null ? { initialData: initialStyles } : {}),
  });

  const items = useMemo(() => query.data ?? [], [query.data]);

  const presentCategories = useMemo(() => {
    const inData = new Set(items.map((s) => s.category));
    return STYLE_CATEGORY_ORDER.filter((id) => inData.has(id));
  }, [items]);

  const filters = useMemo(() => {
    const rest = presentCategories.map((id) => ({
      id,
      label: t(`categoryLabels.${id}` as `categoryLabels.${StyleCategory}`),
    }));
    return [{ id: 'all' as const, label: t('filterAll') }, ...rest];
  }, [t, presentCategories]);

  useEffect(() => {
    if (category !== 'all' && !presentCategories.includes(category)) {
      setCategory('all');
    }
  }, [category, presentCategories]);

  const formatMoney = (cents: number | null): string => {
    if (cents == null) {
      return '—';
    }
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ZAR' }).format(cents / 100);
  };

  const visible = useMemo(
    () => (category === 'all' ? items : items.filter((s) => s.category === category)),
    [items, category],
  );

  if (query.isPending) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <Card key={index} className="flex flex-col overflow-hidden p-0 animate-pulse">
            <div className="aspect-[4/3] bg-brand-cream/60" />
            <div className="space-y-3 px-6 py-5">
              <div className="flex justify-between gap-3">
                <div className="h-5 flex-1 rounded bg-brand-cream/60" />
                <div className="h-5 w-14 rounded bg-brand-cream/45" />
              </div>
              <div className="h-3 w-full rounded bg-brand-cream/40" />
              <div className="h-3 w-[80%] rounded bg-brand-cream/35" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card className="border-red-200 bg-red-50 text-sm text-red-900">
        {t('errorLoad')} {query.error instanceof Error ? query.error.message : t('errorUnknown')}
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="text-sm text-foreground/80">
        {t('emptySeed')}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 scroll-smooth [-webkit-overflow-scrolling:touch]"
        role="tablist"
        aria-label={t('ariaCategories')}
      >
        {filters.map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            role="tab"
            aria-selected={category === id}
            variant={category === id ? 'primary' : 'outline'}
            className="shrink-0 px-3 py-1.5 text-xs uppercase tracking-wide"
            onClick={() => setCategory(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="text-sm text-foreground/80">{t('emptyCategory')}</Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((style) => (
            <Card key={style.id} className="flex flex-col overflow-hidden p-0">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-cream/40">
                {style.imageUrl ? (
                  <Image
                    src={style.imageUrl}
                    alt={style.name}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-foreground/40">
                    {t('imagePlaceholder')}
                  </div>
                )}
              </div>
              <div className="space-y-2 px-6 py-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold uppercase tracking-wide">{style.name}</h2>
                  <span className="text-sm font-semibold tabular-nums text-foreground/80">
                    {formatMoney(style.priceCents)}
                  </span>
                </div>
                {style.description ? (
                  <p className="text-sm text-foreground/75">{style.description}</p>
                ) : null}
                <Link
                  href={`/bookings?styleId=${encodeURIComponent(style.id)}`}
                  className={cn(
                    'mt-4 inline-flex w-full items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold uppercase tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25',
                    'bg-primary text-brand-white shadow-sm hover:bg-brand-orange',
                  )}
                >
                  {t('bookThisStyle')}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
