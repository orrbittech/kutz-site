'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { parseISO } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { BookingDateTimePicker } from '@/components/ui/booking-datetime-picker';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StyleLineDraft } from '@/components/bookings/booking-order-summary-card';
import { formatStylePriceZar } from '@/lib/booking-ui';
import { bookingSlotStepMs, toUtcSlotStartIso } from '@/lib/booking-slot';
import {
  defaultSiteSettingsPublic,
  type SiteSettingsPublic,
} from '@/lib/zod/site-settings';
import type { BookingResponse } from '@/lib/zod/booking';
import type { StyleResponse } from '@/lib/zod/style';

function initialEditStyleLines(row: BookingResponse): StyleLineDraft[] {
  const from = row.styles ?? [];
  if (from.length > 0) {
    return from.map((s) => ({ styleId: s.id, quantity: s.quantity ?? 1 }));
  }
  return row.styleId ? [{ styleId: row.styleId, quantity: 1 }] : [];
}

export function EditBookingInline({
  row,
  sortedStyles,
  bookingSchedule,
  occupiedSlotStarts,
  onSave,
  isPending,
  onClose,
  onCancelBooking,
  cancelBookingDisabled,
}: {
  row: BookingResponse;
  sortedStyles: StyleResponse[];
  bookingSchedule: SiteSettingsPublic;
  occupiedSlotStarts: ReadonlySet<string>;
  onSave: (payload: {
    scheduledAt?: string;
    notes?: string;
    styleLineItems?: StyleLineDraft[];
  }) => void;
  isPending: boolean;
  onClose: () => void;
  onCancelBooking: () => void;
  cancelBookingDisabled: boolean;
}): React.JSX.Element {
  const schedule = bookingSchedule ?? defaultSiteSettingsPublic;
  const editSlotStepMs = bookingSlotStepMs(schedule);
  const extraAvailableSlotStarts = useMemo(
    () => new Set<string>([toUtcSlotStartIso(parseISO(row.scheduledAt), editSlotStepMs)]),
    [row.scheduledAt, editSlotStepMs],
  );
  const localDefault = parseISO(row.scheduledAt).toISOString();
  const [editStyleLines, setEditStyleLines] = useState<StyleLineDraft[]>(() =>
    initialEditStyleLines(row),
  );

  const catalogIdSet = useMemo(() => new Set(sortedStyles.map((s) => s.id)), [sortedStyles]);
  const orderedValidStyleLines = useMemo(
    () =>
      editStyleLines.filter(
        (line) => catalogIdSet.has(line.styleId) && line.quantity >= 1,
      ),
    [editStyleLines, catalogIdSet],
  );

  const editServicesTriggerLabel = useMemo(() => {
    const picked = sortedStyles.filter((s) =>
      orderedValidStyleLines.some((l) => l.styleId === s.id),
    );
    if (picked.length === 0) return 'Choose services…';
    if (picked.length === 1) return picked[0].name;
    return `${picked.length} services`;
  }, [sortedStyles, orderedValidStyleLines]);

  const form = useForm({
    resolver: zodResolver(
      z.object({
        scheduledAt: z.string().min(1),
        notes: z.string().max(2000).optional(),
      }),
    ),
    defaultValues: { scheduledAt: localDefault, notes: row.notes },
  });

  function setEditQty(styleId: string, nextQty: number): void {
    if (nextQty < 1) {
      setEditStyleLines((prev) => prev.filter((l) => l.styleId !== styleId));
      return;
    }
    setEditStyleLines((prev) =>
      prev.map((l) =>
        l.styleId === styleId ? { ...l, quantity: Math.min(99, nextQty) } : l,
      ),
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit((values) => {
        if (orderedValidStyleLines.length < 1) {
          toast.error('Pick at least one service.');
          return;
        }
        const scheduledAt = new Date(values.scheduledAt).toISOString();
        onSave({
          scheduledAt,
          notes: values.notes?.trim() ? values.notes : '',
          styleLineItems: orderedValidStyleLines,
        });
      })}
    >
      <div className="space-y-1">
        <span
          id={`edit-booking-services-${row.id}`}
          className="block text-xs font-semibold uppercase text-foreground/70"
        >
          Services
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="flex h-auto min-h-[2.75rem] w-full justify-between gap-2 whitespace-normal py-2 text-left font-normal normal-case"
              aria-labelledby={`edit-booking-services-${row.id}`}
            >
              <span className="line-clamp-2 flex-1">{editServicesTriggerLabel}</span>
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 opacity-50" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)] max-w-[min(100vw-2rem,24rem)]"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuLabel className="font-normal text-foreground/80">
              Choose one or more services
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {sortedStyles.map((s) => (
              <DropdownMenuCheckboxItem
                key={s.id}
                checked={editStyleLines.some((l) => l.styleId === s.id)}
                onCheckedChange={(checked) => {
                  setEditStyleLines((prev) => {
                    if (checked) {
                      if (prev.some((l) => l.styleId === s.id)) return prev;
                      return [...prev, { styleId: s.id, quantity: 1 }];
                    }
                    return prev.filter((l) => l.styleId !== s.id);
                  });
                }}
                onSelect={(e) => e.preventDefault()}
              >
                <span className="flex flex-col gap-0.5">
                  <span>{s.name}</span>
                  {s.priceCents != null ? (
                    <span className="text-xs font-normal text-foreground/60">
                      {formatStylePriceZar(s.priceCents)}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {orderedValidStyleLines.length > 0 ? (
          <ul className="mt-2 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2 text-sm">
            {orderedValidStyleLines.map((line) => {
              const s = sortedStyles.find((x) => x.id === line.styleId);
              if (!s) return null;
              return (
                <li
                  key={line.styleId}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="min-w-0 font-medium text-foreground">{s.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 w-8 shrink-0 p-0 text-xs"
                      aria-label="Decrease quantity"
                      onClick={() => setEditQty(line.styleId, line.quantity - 1)}
                    >
                      −
                    </Button>
                    <span className="w-8 text-center tabular-nums">{line.quantity}</span>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 w-8 shrink-0 p-0 text-xs"
                      aria-label="Increase quantity"
                      disabled={line.quantity >= 99}
                      onClick={() => setEditQty(line.styleId, line.quantity + 1)}
                    >
                      +
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase text-foreground/70">New date & time</label>
        <Controller
          control={form.control}
          name="scheduledAt"
          render={({ field }) => (
            <BookingDateTimePicker
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              bookingTimeZone={schedule.bookingTimeZone}
              bookingHours={schedule.bookingHours}
              slotStepMinutes={schedule.bookingSlotStepMinutes}
              slotStepMs={bookingSlotStepMs(schedule)}
              occupiedSlotStarts={occupiedSlotStarts}
              extraAvailableSlotStarts={extraAvailableSlotStarts}
            />
          )}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase text-foreground/70">Notes</label>
        <textarea rows={2} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" {...form.register('notes')} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
        <Button type="button" variant="outline" className="text-xs" onClick={onClose}>
          Close
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-xs bg-red-600 text-white hover:bg-red-700 hover:text-white disabled:opacity-50"
          disabled={cancelBookingDisabled}
          onClick={onCancelBooking}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="text-xs" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
