'use client';

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  calendarYmdInZone,
  isSlotStartInPast,
  listBookableSlotStartsUtc,
} from '@/lib/booking-hours';
import type { BookingHoursSpec } from '@/lib/zod/site-settings';
import { toUtcSlotStartIso } from '@/lib/booking-slot';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const DISPLAY_FMT = 'yyyy/MM/dd, HH:mm';

function parseValueToDate(value: string): Date {
  const safe = value?.trim() || '';
  if (!safe) return new Date();
  const isoTry = new Date(safe);
  if (!Number.isNaN(isoTry.getTime())) return isoTry;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(safe);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    const hh = Number(match[4]);
    const mm = Number(match[5]);
    return new Date(y, m, d, hh, mm, 0, 0);
  }
  return new Date();
}

function startOfTodayInZone(nowUtc: Date, timeZone: string): Date {
  const ymd = formatInTimeZone(nowUtc, timeZone, 'yyyy-MM-dd');
  return fromZonedTime(`${ymd}T00:00:00`, timeZone);
}

export type BookingDateTimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  bookingTimeZone: string;
  bookingHours: BookingHoursSpec;
  /** Session + break (minutes); must match site settings grid. */
  slotStepMinutes: number;
  slotStepMs: number;
  /** UTC ISO keys from occupancy where slot is full for relevant styles */
  occupiedSlotStarts?: ReadonlySet<string>;
  /** Slots that stay selectable (e.g. current booking when rescheduling) */
  extraAvailableSlotStarts?: ReadonlySet<string>;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  className?: string;
};

const EMPTY_SLOT_SET: ReadonlySet<string> = new Set();

export function BookingDateTimePicker({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  bookingTimeZone,
  bookingHours,
  slotStepMinutes,
  slotStepMs,
  occupiedSlotStarts = EMPTY_SLOT_SET,
  extraAvailableSlotStarts,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  className,
}: BookingDateTimePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const selectedInstant = useMemo(() => parseValueToDate(value), [value]);

  const display = useMemo(() => {
    try {
      return formatInTimeZone(selectedInstant, bookingTimeZone, DISPLAY_FMT);
    } catch {
      return value;
    }
  }, [selectedInstant, bookingTimeZone, value]);

  const { year, monthIndex, day } = calendarYmdInZone(selectedInstant, bookingTimeZone);

  const slots = useMemo(
    () =>
      listBookableSlotStartsUtc(
        bookingTimeZone,
        bookingHours,
        year,
        monthIndex,
        day,
        slotStepMinutes,
        slotStepMs,
      ),
    [bookingTimeZone, bookingHours, year, monthIndex, day, slotStepMinutes, slotStepMs],
  );

  const selectedSlotKey = useMemo(
    () => toUtcSlotStartIso(selectedInstant, slotStepMs),
    [selectedInstant, slotStepMs],
  );

  const todayStartInZone = useMemo(
    () => startOfTodayInZone(nowTick, bookingTimeZone),
    [nowTick, bookingTimeZone],
  );

  function applyCalendarDay(next: Date): void {
    const { year: y, monthIndex: mi, day: d } = calendarYmdInZone(next, bookingTimeZone);
    const daySlots = listBookableSlotStartsUtc(
      bookingTimeZone,
      bookingHours,
      y,
      mi,
      d,
      slotStepMinutes,
      slotStepMs,
    );
    const nextSlot =
      daySlots.find((s) => {
        const key = toUtcSlotStartIso(s, slotStepMs);
        if (extraAvailableSlotStarts?.has(key)) return true;
        if (occupiedSlotStarts.has(key)) return false;
        return !isSlotStartInPast(nowTick, s);
      }) ?? daySlots[0];
    if (nextSlot) onChange(nextSlot.toISOString());
  }

  function slotKey(slot: Date): string {
    return toUtcSlotStartIso(slot, slotStepMs);
  }

  function isTaken(slot: Date): boolean {
    const key = slotKey(slot);
    if (extraAvailableSlotStarts?.has(key)) return false;
    return occupiedSlotStarts.has(key);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          disabled={disabled}
          onBlur={onBlur}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'h-11 w-full min-h-[44px] justify-between rounded-lg border-border bg-card px-3 py-2 text-left font-normal',
            className,
          )}
        >
          <span className="truncate">{display}</span>
          <CalendarIcon className="size-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[min(100vw-2rem,42rem)] p-0" align="start">
        <div className="flex flex-col gap-3 p-3 lg:flex-row">
          <Calendar
            mode="single"
            selected={selectedInstant}
            onSelect={(d) => {
              if (d) applyCalendarDay(d);
            }}
            weekStartsOn={1}
            initialFocus
            disabled={{ before: todayStartInZone }}
          />
          <div className="flex min-w-0 flex-col gap-2 border-t border-border p-3 lg:w-[min(100%,20rem)] lg:border-l lg:border-t-0 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Time</p>
            {slots.length === 0 ? (
              <p className="text-xs text-foreground/65">Closed this day.</p>
            ) : (
              <div className="grid max-h-[min(50vh,14rem)] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {slots.map((slot) => {
                  const key = slotKey(slot);
                  const taken = isTaken(slot);
                  const past = isSlotStartInPast(nowTick, slot);
                  const unavailable = taken || past;
                  const label = formatInTimeZone(slot, bookingTimeZone, 'p');
                  const selected = !unavailable && key === selectedSlotKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={unavailable}
                      onClick={() => onChange(slot.toISOString())}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-center text-xs font-medium transition',
                        unavailable
                          ? 'cursor-not-allowed border-red-200/90 bg-red-50/90 text-foreground/50'
                          : selected
                            ? 'border-emerald-800 bg-emerald-700 text-white hover:bg-emerald-800'
                            : 'border-emerald-200/90 bg-emerald-50/90 text-foreground hover:border-emerald-300',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <Button type="button" variant="primary" className="w-full text-xs" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
