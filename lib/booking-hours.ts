/** Keep slot grid logic aligned with `server/src/bookings/booking-hours.util.ts`. */
import { addDays, addHours } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { bookingSlotStepMs, floorToSlotUtc } from '@/lib/booking-slot';
import type { BookingHoursSpec, SiteSettingsPublic } from '@/lib/zod/site-settings';

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map((x) => Number.parseInt(x, 10));
  return h * 60 + m;
}

function openCloseForJsWeekday(
  spec: BookingHoursSpec,
  jsWeekday: number,
): { openMin: number; closeMin: number } | null {
  for (const r of spec.rules) {
    if (r.daysOfWeek.includes(jsWeekday)) {
      return {
        openMin: hmToMinutes(r.open),
        closeMin: hmToMinutes(r.close),
      };
    }
  }
  return null;
}

function isoDayToJs(iso: number): number {
  return iso === 7 ? 0 : iso;
}

function jsWeekdayForCalendarDayInZone(
  timeZone: string,
  year: number,
  monthIndex: number,
  day: number,
): number {
  const iso = fromZonedTime(
    `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`,
    timeZone,
  );
  const i = Number.parseInt(formatInTimeZone(iso, timeZone, 'i'), 10);
  return isoDayToJs(i);
}

function wallTimeToUtc(
  timeZone: string,
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  return fromZonedTime(iso, timeZone);
}

export function listBookableSlotStartsUtc(
  timeZone: string,
  spec: BookingHoursSpec,
  year: number,
  monthIndex: number,
  day: number,
  slotStepMinutes: number,
  slotStepMs: number,
): Date[] {
  const jsDow = jsWeekdayForCalendarDayInZone(timeZone, year, monthIndex, day);
  const win = openCloseForJsWeekday(spec, jsDow);
  if (!win) return [];
  const { openMin, closeMin } = win;
  if (closeMin <= openMin) return [];
  const out: Date[] = [];
  for (let m = openMin; m < closeMin; m += slotStepMinutes) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    const utc = wallTimeToUtc(timeZone, year, monthIndex, day, hh, mm);
    out.push(floorToSlotUtc(utc, slotStepMs));
  }
  return out;
}

export function isSlotStartInPast(nowUtc: Date, slotStartUtc: Date): boolean {
  return nowUtc.getTime() >= slotStartUtc.getTime();
}

export function calendarYmdInZone(instant: Date, timeZone: string): {
  year: number;
  monthIndex: number;
  day: number;
} {
  return {
    year: Number.parseInt(formatInTimeZone(instant, timeZone, 'yyyy'), 10),
    monthIndex: Number.parseInt(formatInTimeZone(instant, timeZone, 'MM'), 10) - 1,
    day: Number.parseInt(formatInTimeZone(instant, timeZone, 'dd'), 10),
  };
}

/**
 * First bookable slot strictly after `Date.now()` within the next `maxDays` calendar days
 * (in shop TZ). Falls back to `now + 2h` ISO if nothing is found.
 */
export function findEarliestBookableSlotIso(
  schedule: SiteSettingsPublic,
  fromInstant: Date,
  maxDaysToScan: number,
): string {
  const stepMs = bookingSlotStepMs(schedule);
  const { bookingTimeZone, bookingHours, bookingSlotStepMinutes } = schedule;
  const nowMs = Date.now();
  for (let d = 0; d < maxDaysToScan; d++) {
    const probe = addDays(fromInstant, d);
    const { year, monthIndex, day } = calendarYmdInZone(probe, bookingTimeZone);
    const slots = listBookableSlotStartsUtc(
      bookingTimeZone,
      bookingHours,
      year,
      monthIndex,
      day,
      bookingSlotStepMinutes,
      stepMs,
    );
    const next =
      slots.find((sl) => sl.getTime() > nowMs) ??
      slots.find((sl) => !isSlotStartInPast(new Date(), sl));
    if (next) {
      return next.toISOString();
    }
  }
  return addHours(fromInstant, 2).toISOString();
}
