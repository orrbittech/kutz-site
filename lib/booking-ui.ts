import type { BookingResponse } from '@/lib/zod/booking';
import { BookingPaymentStatus, BookingStatus } from '@/lib/constants/enums';

export function formatStylePriceZar(cents: number | null): string {
  if (cents == null) {
    return '—';
  }
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
}

export function bookingStatusBadgeClass(status: BookingResponse['status']): string {
  switch (status) {
    case BookingStatus.PENDING:
      return 'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-400/80';
    case BookingStatus.CONFIRMED:
      return 'bg-emerald-100 text-emerald-950 ring-1 ring-inset ring-emerald-400/80';
    case BookingStatus.CANCELLED:
      return 'bg-red-100 text-red-950 ring-1 ring-inset ring-red-400/80';
    case BookingStatus.SERVICED:
      return 'bg-slate-200/90 text-slate-900 ring-1 ring-inset ring-slate-400/70';
    default:
      return 'bg-muted text-foreground ring-1 ring-inset ring-border';
  }
}

export function formatBookingStatusLabel(status: BookingResponse['status']): string {
  switch (status) {
    case BookingStatus.PENDING:
      return 'Pending';
    case BookingStatus.CONFIRMED:
      return 'Confirmed';
    case BookingStatus.CANCELLED:
      return 'Cancelled';
    case BookingStatus.SERVICED:
      return 'Serviced';
    default:
      return String(status);
  }
}

export function paymentStatusBadgeClass(
  ps: BookingResponse['paymentStatus'],
): string {
  switch (ps) {
    case BookingPaymentStatus.PAID:
      return 'bg-emerald-100 text-emerald-950 ring-1 ring-inset ring-emerald-400/80';
    case BookingPaymentStatus.PARTIAL:
      return 'bg-violet-100 text-violet-950 ring-1 ring-inset ring-violet-400/80';
    case BookingPaymentStatus.UNPAID:
      return 'bg-rose-100 text-rose-950 ring-1 ring-inset ring-rose-400/80';
    case BookingPaymentStatus.NOT_REQUIRED:
      return 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300/90';
    default:
      return 'bg-muted text-foreground ring-1 ring-inset ring-border';
  }
}

export function formatPaymentStatusLabel(ps: BookingResponse['paymentStatus']): string {
  switch (ps) {
    case BookingPaymentStatus.PAID:
      return 'Paid';
    case BookingPaymentStatus.PARTIAL:
      return 'Partial';
    case BookingPaymentStatus.UNPAID:
      return 'Unpaid';
    case BookingPaymentStatus.NOT_REQUIRED:
      return 'No charge';
    default:
      return String(ps);
  }
}

export function serviceTitlePaidClass(row: BookingResponse): string {
  if (row.paymentStatus === BookingPaymentStatus.PAID) {
    return 'text-emerald-800';
  }
  return '';
}

/**
 * Priority when multiple bookings share a day: PENDING → CONFIRMED → CANCELLED → SERVICED.
 */
export function calendarDayAccentFromBookings(
  list: BookingResponse[] | undefined,
): { borderUnselected: string } | null {
  if (!list?.length) return null;
  if (list.some((b) => b.status === BookingStatus.PENDING)) {
    return { borderUnselected: 'border-amber-400' };
  }
  if (list.some((b) => b.status === BookingStatus.CONFIRMED)) {
    return { borderUnselected: 'border-emerald-500' };
  }
  if (list.some((b) => b.status === BookingStatus.CANCELLED)) {
    return { borderUnselected: 'border-red-400' };
  }
  if (list.some((b) => b.status === BookingStatus.SERVICED)) {
    return { borderUnselected: 'border-slate-400' };
  }
  return null;
}

export function serviceLabel(row: BookingResponse): string {
  if (row.styles?.length) {
    return row.styles
      .map((s) =>
        (s.quantity ?? 1) > 1 ? `${s.name} × ${s.quantity}` : s.name,
      )
      .join(' · ');
  }
  return row.style?.name ?? row.styleName ?? '—';
}
