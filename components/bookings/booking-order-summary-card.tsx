'use client';

import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Minus, Plus, Trash2, User } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, type JSX } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { StyleResponse } from '@/lib/zod/style';

export type StyleLineDraft = { styleId: string; quantity: number };

function formatStylePriceZar(cents: number | null): string {
  if (cents == null) {
    return '—';
  }
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
}

function styleInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export type BookingOrderSummaryCardProps = {
  styleLineItems: StyleLineDraft[];
  sortedStyles: StyleResponse[];
  scheduledAtIso: string;
  notes: string;
  businessName: string;
  /** Loading: "…", guest when signed out: "", signed-in: display name */
  clientDisplayName: string;
  /** Signed-in profile image URL (e-receipt; plain img for Clerk-hosted avatars). */
  clientAvatarUrl?: string | null;
  /** When set, each line shows remove; quantity can go to zero via − or trash (parent removes). */
  onRequestRemoveStyle?: (styleId: string) => void;
  onChangeQuantity?: (styleId: string, quantity: number) => void;
  className?: string;
};

/**
 * Right-column order summary when the user has services selected for a new booking.
 */
export function BookingOrderSummaryCard({
  styleLineItems,
  sortedStyles,
  scheduledAtIso,
  notes,
  businessName,
  clientDisplayName,
  clientAvatarUrl,
  onRequestRemoveStyle,
  onChangeQuantity,
  className,
}: BookingOrderSummaryCardProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const t = useTranslations('bookingsPage');
  const tFooter = useTranslations('footer');
  const year = useMemo(() => new Date().getFullYear(), []);

  const byId = useMemo(() => new Map(sortedStyles.map((s) => [s.id, s])), [sortedStyles]);
  const lines = useMemo(() => {
    return styleLineItems
      .map((line) => {
        const s = byId.get(line.styleId);
        if (!s) return null;
        return { style: s, quantity: line.quantity };
      })
      .filter((x): x is { style: StyleResponse; quantity: number } => Boolean(x));
  }, [styleLineItems, byId]);

  const totalCents = useMemo(() => {
    const parts = lines.map((l) => {
      const p = l.style.priceCents;
      if (p == null) return null;
      return p * l.quantity;
    });
    if (parts.some((p) => p == null)) return null;
    return parts.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) as number;
  }, [lines]);

  let dateTimeLabel = '—';
  try {
    if (scheduledAtIso?.trim()) {
      dateTimeLabel = `${format(parseISO(scheduledAtIso), 'EEEE, MMM d, yyyy')} · ${format(parseISO(scheduledAtIso), 'p')}`;
    }
  } catch {
    dateTimeLabel = '—';
  }

  const notesTrimmed = notes.trim();
  const notesDisplay = notesTrimmed.length > 0 ? notesTrimmed : '—';

  const clientLine =
    clientDisplayName === '…' ? (
      <span className="text-foreground/50">…</span>
    ) : clientDisplayName === '' ? (
      <span className="font-medium text-foreground/85">{t('receiptGuest')}</span>
    ) : (
      <span className="font-medium text-foreground/90">{clientDisplayName}</span>
    );

  const avatarPhoto = clientAvatarUrl?.trim();
  const clientAvatarLoading = clientDisplayName === '…';
  const clientIsGuest = clientDisplayName === '';
  const showInitialsAvatar =
    !clientAvatarLoading && !avatarPhoto && !clientIsGuest && clientDisplayName.length > 0;

  return (
    <Card
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden border-dashed border-border/80 bg-card p-5 shadow-sm',
        className,
      )}
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">{t('orderSummaryTitle')}</h2>
      <div className="mt-4 shrink-0 border-b border-dashed border-border/70 px-1 pb-4 text-center">
        <p className="text-base font-semibold uppercase tracking-[0.25em] text-foreground">{businessName}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/55">
          {t('receiptOnlineBooking')}
        </p>
        <p className="mt-0.5 text-[10px] text-foreground/45">{t('receiptPurchaseType')}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-1 pt-4">
        <div className="min-h-0 max-h-[min(36rem,65dvh)] flex-1 overflow-y-auto overscroll-y-contain rounded-lg border border-border bg-muted/25 p-4 text-sm">
          <div className="space-y-2 border-b border-border/60 pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/50">{t('receiptClient')}</p>
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted/40">
                {clientAvatarLoading ? (
                  <motion.span
                    className="block h-full w-full bg-muted"
                    aria-hidden
                    initial={false}
                    animate={
                      reduceMotion
                        ? { opacity: 1 }
                        : { opacity: [0.55, 1, 0.55] }
                    }
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                    }
                  />
                ) : avatarPhoto ? (
                  <img
                    src={avatarPhoto}
                    alt=""
                    className="h-full w-full object-cover"
                    width={40}
                    height={40}
                  />
                ) : showInitialsAvatar ? (
                  <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-foreground/55">
                    {styleInitials(clientDisplayName)}
                  </span>
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-foreground/40">
                    <User className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                )}
              </div>
              <p className="min-w-0 flex-1 text-sm leading-snug">{clientLine}</p>
            </div>
          </div>

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/50">Services</p>
          <ul className="mt-2 space-y-3">
            {lines.map(({ style: s, quantity }) => {
              const lineSubtotal =
                s.priceCents != null ? s.priceCents * quantity : null;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-brand-cream/50">
                    {s.imageUrl ? (
                      <Image
                        src={s.imageUrl}
                        alt={s.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-foreground/40"
                        aria-hidden
                      >
                        {styleInitials(s.name)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug text-balance text-foreground">{s.name}</p>
                  </div>
                  {onChangeQuantity ? (
                    <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/80 bg-background/80 p-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 p-0 text-foreground/70 hover:text-foreground"
                        aria-label={t('decreaseQtyAria')}
                        onClick={() => onChangeQuantity(s.id, quantity - 1)}
                      >
                        <Minus className="mx-auto h-4 w-4" aria-hidden />
                      </Button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-foreground">
                        {quantity}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 p-0 text-foreground/70 hover:text-foreground"
                        aria-label={t('increaseQtyAria')}
                        disabled={quantity >= 99}
                        onClick={() => onChangeQuantity(s.id, quantity + 1)}
                      >
                        <Plus className="mx-auto h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                  <span className="shrink-0 tabular-nums text-sm font-semibold text-foreground/85">
                    {lineSubtotal == null ? '—' : formatStylePriceZar(lineSubtotal)}
                  </span>
                  {onRequestRemoveStyle ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 p-0 text-foreground/55 hover:text-red-600"
                      aria-label={t('removeServiceAria')}
                      onClick={() => onRequestRemoveStyle(s.id)}
                    >
                      <Trash2 className="mx-auto h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 space-y-1 border-t border-border/60 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/50">{t('receiptNotes')}</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{notesDisplay}</p>
          </div>

          <p className="mt-4 text-sm text-foreground/80">{dateTimeLabel}</p>

          <p className="mt-4 border-t border-border/80 pt-3 text-base font-semibold text-foreground">
            {t('receiptTotal')}: {totalCents == null ? '—' : formatStylePriceZar(totalCents)}
          </p>
        </div>

        <div className="mt-auto shrink-0 space-y-2 border-t border-dashed border-border/70 pt-4 text-center text-[10px] leading-relaxed text-foreground/50">
          <p className="line-clamp-3">{tFooter('tagline')}</p>
          <p>{tFooter('copyrightBusiness', { year, businessName })}</p>
        </div>
      </div>
    </Card>
  );
}
