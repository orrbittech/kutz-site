import { BookingPaymentStatus, BookingStatus } from '@/lib/constants/enums';
import type { BookingResponse } from '@/lib/zod/booking';

/** Matches server: Stripe card minimum for ZAR (R1). */
export const STRIPE_MIN_ZAR_CHARGE_CENTS = 100;

export function sumBookingStylesCents(
  styles: { priceCents: number | null }[],
): number {
  return styles.reduce((acc, s) => acc + (s.priceCents ?? 0), 0);
}

/** Mirrors server `bookingRequiresCardPayment` (Stripe ZAR minimum). */
function totalRequiresCardPayment(totalCents: number): boolean {
  return totalCents >= STRIPE_MIN_ZAR_CHARGE_CENTS;
}

/**
 * Prefer stored total when set and positive; if stored is 0 but style prices imply
 * a real total (e.g. legacy row), use the style sum — mirrors server `resolveTotalDueCents`.
 */
function resolveEffectiveTotalDue(row: BookingResponse): number {
  const styleSum = sumBookingStylesCents(row.styles);
  const stored = row.totalDueCents;
  if (stored != null && stored > 0) {
    return stored;
  }
  if (stored == null) {
    return styleSum;
  }
  // stored === 0: treat as missing when styles show a chargeable total
  if (styleSum >= STRIPE_MIN_ZAR_CHARGE_CENTS) {
    return styleSum;
  }
  return 0;
}

/**
 * Trust positive outstanding from API; otherwise derive from total − paid.
 * If API sends 0 but computed outstanding is positive (stale/zero bug), use computed.
 */
function resolveEffectiveOutstanding(row: BookingResponse, totalDue: number): number {
  const paid = row.amountPaidCents ?? 0;
  const computed = Math.max(0, totalDue - paid);
  const stored = row.outstandingCents;
  if (stored != null && stored > 0) {
    return stored;
  }
  if (stored == null) {
    return computed;
  }
  // stored === 0
  return computed > 0 ? computed : 0;
}

/**
 * Mirrors `BookingsService.createPaymentIntentForBooking` eligibility so the Pay now
 * button matches what the API will accept.
 */
export function bookingNeedsCardPayment(row: BookingResponse): boolean {
  if (row.status === BookingStatus.CANCELLED || row.status === BookingStatus.SERVICED) {
    return false;
  }
  if (row.paymentStatus === BookingPaymentStatus.PAID) {
    return false;
  }
  if (row.paymentStatus === BookingPaymentStatus.NOT_REQUIRED) {
    return false;
  }

  const eligibleForIntent =
    row.status === BookingStatus.PENDING ||
    row.paymentStatus === BookingPaymentStatus.PARTIAL;
  if (!eligibleForIntent) {
    return false;
  }

  const totalDue = resolveEffectiveTotalDue(row);
  if (!totalRequiresCardPayment(totalDue)) {
    return false;
  }

  const outstanding = resolveEffectiveOutstanding(row, totalDue);
  if (outstanding <= 0 || outstanding < STRIPE_MIN_ZAR_CHARGE_CENTS) {
    return false;
  }

  return true;
}
