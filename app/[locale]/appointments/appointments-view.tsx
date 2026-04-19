'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ClipboardCopy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EditBookingInline } from '@/components/bookings/edit-booking-inline';
import { cn } from '@/lib/cn';
import { bookingNeedsCardPayment } from '@/lib/booking-payment';
import {
  bookingStatusBadgeClass,
  calendarDayAccentFromBookings,
  formatBookingStatusLabel,
  formatPaymentStatusLabel,
  formatStylePriceZar,
  paymentStatusBadgeClass,
  serviceLabel,
  serviceTitlePaidClass,
} from '@/lib/booking-ui';
import { useRouter } from '@/i18n/navigation';
import { queryKeys } from '@/lib/api/query-keys';
import { publicFetch } from '@/lib/api/public-fetch';
import { safeClientErrorMessage } from '@/lib/api/safe-client-error';
import { useAuthedFetch } from '@/lib/api/use-authed-fetch';
import { bookingSlotStepMs } from '@/lib/booking-slot';
import {
  defaultSiteSettingsPublic,
  siteSettingsPublicSchema,
  type SiteSettingsPublic,
} from '@/lib/zod/site-settings';
import {
  bookingListSchema,
  bookingOccupancyResponseSchema,
  bookingPaymentIntentResponseSchema,
  bookingResponseSchema,
  updateBookingSchema,
  type BookingResponse,
} from '@/lib/zod/booking';
import { styleListSchema, type StyleResponse } from '@/lib/zod/style';
import { BookingPaymentStatus } from '@/lib/constants/enums';

const BookingPaymentCheckout = dynamic(
  () =>
    import('@/components/bookings/booking-payment-checkout').then((m) => m.BookingPaymentCheckout),
  { ssr: false },
);

export function AppointmentsView(): React.JSX.Element {
  const t = useTranslations('bookingsPage');
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const fetchAuthed = useAuthedFetch();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [paymentSession, setPaymentSession] = useState<{
    bookingId: string;
    clientSecret: string;
    amountCents: number;
    serviceSummary: string;
    scheduledAtIso: string;
  } | null>(null);
  const suppressPaymentDismissToastRef = useRef(false);
  const paymentDialogDismissGuardRef = useRef(false);

  useEffect(() => {
    if (paymentSession !== null) {
      suppressPaymentDismissToastRef.current = false;
    }
  }, [paymentSession]);

  const siteSettingsQuery = useQuery({
    queryKey: queryKeys.siteSettingsPublic,
    queryFn: async () => {
      const raw = await publicFetch<unknown>('/public/site-settings');
      return siteSettingsPublicSchema.parse(raw);
    },
    staleTime: 60_000,
  });

  const bookingSchedule = siteSettingsQuery.data ?? defaultSiteSettingsPublic;

  const stylesQuery = useQuery({
    queryKey: queryKeys.styles,
    queryFn: async () => {
      const raw = await publicFetch<unknown>('/styles');
      return styleListSchema.parse(raw);
    },
    staleTime: 60_000,
  });

  const sortedStyles = useMemo((): StyleResponse[] => {
    if (!stylesQuery.data?.length) return [];
    return [...stylesQuery.data].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [stylesQuery.data]);

  const occupancyRange = useMemo(() => {
    const from = startOfMonth(cursor);
    const to = startOfMonth(addMonths(cursor, 1));
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }, [cursor]);

  const occupancyStyleKey = useMemo(() => {
    return sortedStyles.map((s) => s.id).sort().join(',');
  }, [sortedStyles]);

  const occupancyQuery = useQuery({
    queryKey: queryKeys.bookingsOccupancy(
      occupancyRange.fromIso,
      occupancyRange.toIso,
      occupancyStyleKey,
    ),
    queryFn: async () => {
      const params = new URLSearchParams({
        from: occupancyRange.fromIso,
        to: occupancyRange.toIso,
        styleIds: occupancyStyleKey,
      });
      const raw = await publicFetch<unknown>(`/public/bookings/occupancy?${params.toString()}`);
      return bookingOccupancyResponseSchema.parse(raw);
    },
    staleTime: 15_000,
    enabled: sortedStyles.length > 0 && occupancyStyleKey.length > 0,
  });

  const effectiveOccupancyStyleIds = useMemo(
    () => sortedStyles.map((s) => s.id),
    [sortedStyles],
  );

  const lineQtyByStyleId = useMemo(() => ({} as Record<string, number>), []);

  const occupiedSlotStarts = useMemo(() => {
    const next = new Set<string>();
    const seats = bookingSchedule.bookingConcurrentSeatsPerSlot;
    for (const row of occupancyQuery.data?.slots ?? []) {
      let full = false;
      for (const sid of effectiveOccupancyStyleIds) {
        const c = row.byStyleId[sid] ?? 0;
        const need = lineQtyByStyleId[sid] ?? 1;
        if (c + need > seats) {
          full = true;
          break;
        }
      }
      if (full) next.add(row.slotStart);
    }
    return next;
  }, [
    occupancyQuery.data,
    effectiveOccupancyStyleIds,
    bookingSchedule.bookingConcurrentSeatsPerSlot,
    lineQtyByStyleId,
  ]);

  const occupancyByDay = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of occupancyQuery.data?.slots ?? []) {
      const anyBusy = Object.values(row.byStyleId).some((n) => n > 0);
      if (!anyBusy) continue;
      const dayKey = format(parseISO(row.slotStart), 'yyyy-MM-dd');
      map.set(dayKey, true);
    }
    return map;
  }, [occupancyQuery.data]);

  const listQuery = useQuery({
    queryKey: queryKeys.bookings,
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const raw = await fetchAuthed<unknown>('/bookings');
      return bookingListSchema.parse(raw) as BookingResponse[];
    },
    staleTime: 15_000,
  });

  const bookings = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const paymentIntentMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const raw = await fetchAuthed<unknown>(`/bookings/${bookingId}/payment-intent`, {
        method: 'POST',
      });
      return bookingPaymentIntentResponseSchema.parse(raw);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      scheduledAt?: string;
      notes?: string;
      styleLineItems?: import('@/components/bookings/booking-order-summary-card').StyleLineDraft[];
    }) => {
      const body = updateBookingSchema.parse({
        scheduledAt: input.scheduledAt,
        notes: input.notes,
        styleLineItems: input.styleLineItems,
      });
      const raw = await fetchAuthed<unknown>(`/bookings/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return bookingResponseSchema.parse(raw);
    },
    onSuccess: async () => {
      toast.success('✅ Booking updated');
      setEditingId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bookingsOccupancyPrefix }),
      ]);
    },
    onError: (err: unknown) => {
      toast.error(`❌ ${safeClientErrorMessage(err, 'Could not update booking')}`);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const raw = await fetchAuthed<unknown>(`/bookings/${id}/cancel`, {
        method: 'POST',
      });
      return bookingResponseSchema.parse(raw);
    },
    onSuccess: async () => {
      toast.success('✅ Booking cancelled');
      setPendingCancelId(null);
      setEditingId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bookingsOccupancyPrefix }),
      ]);
    },
    onError: (err: unknown) => {
      toast.error(`❌ ${safeClientErrorMessage(err, 'Could not cancel booking')}`);
    },
  });

  const sortedBookings = useMemo(
    () =>
      [...bookings].sort(
        (a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime(),
      ),
    [bookings],
  );

  const visibleBookings = useMemo(() => {
    if (!selectedDay) return sortedBookings;
    return sortedBookings.filter((b) => isSameDay(parseISO(b.scheduledAt), selectedDay));
  }, [sortedBookings, selectedDay]);

  useEffect(() => {
    if (editingId && !visibleBookings.some((b) => b.id === editingId)) {
      setEditingId(null);
    }
  }, [visibleBookings, editingId]);

  const stripeRedirectStatus = searchParams.get('redirect_status');
  const stripeReturnBookingId = searchParams.get('bookingId');
  useEffect(() => {
    if (stripeRedirectStatus !== 'succeeded' || typeof window === 'undefined') {
      return;
    }
    const bookingIdFromUrl = stripeReturnBookingId;
    void (async () => {
      if (bookingIdFromUrl) {
        try {
          await fetchAuthed<unknown>(`/bookings/${bookingIdFromUrl}/payment`, {
            method: 'PATCH',
            body: JSON.stringify({}),
          });
        } catch {
          const maxWait = 8000;
          const start = Date.now();
          while (Date.now() - start < maxWait) {
            await queryClient.refetchQueries({ queryKey: queryKeys.bookings });
            const list = queryClient.getQueryData<BookingResponse[]>(queryKeys.bookings);
            const b = list?.find((x) => x.id === bookingIdFromUrl);
            if (
              b?.paymentStatus === BookingPaymentStatus.PAID ||
              b?.paymentStatus === BookingPaymentStatus.PARTIAL
            ) {
              break;
            }
            await new Promise((r) => setTimeout(r, 400));
          }
        }
      }
      toast.success('Payment received');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bookingsOccupancyPrefix }),
      ]);
      suppressPaymentDismissToastRef.current = true;
      setPaymentSession(null);
      const next = new URL(window.location.href);
      next.searchParams.delete('payment_intent');
      next.searchParams.delete('payment_intent_client_secret');
      next.searchParams.delete('redirect_status');
      next.searchParams.delete('bookingId');
      router.replace(`${next.pathname}${next.search}`);
    })();
  }, [stripeRedirectStatus, stripeReturnBookingId, queryClient, router, fetchAuthed]);

  async function handlePayBooking(row: BookingResponse): Promise<void> {
    try {
      const pi = await paymentIntentMutation.mutateAsync(row.id);
      const summary =
        row.styles
          ?.map((s) =>
            (s.quantity ?? 1) > 1 ? `${s.name} × ${s.quantity}` : s.name,
          )
          .join(' · ') ?? row.styleName ?? 'Appointment';
      setPaymentSession({
        bookingId: row.id,
        clientSecret: pi.clientSecret,
        amountCents: pi.amountCents,
        serviceSummary: summary,
        scheduledAtIso: row.scheduledAt,
      });
      toast.success('Complete payment in the dialog.');
    } catch (err: unknown) {
      toast.error(`❌ ${safeClientErrorMessage(err, 'Could not start payment')}`);
    }
  }

  function handlePaymentDialogOpenChange(open: boolean): void {
    if (open) return;
    if (paymentDialogDismissGuardRef.current) return;
    paymentDialogDismissGuardRef.current = true;
    try {
      if (!suppressPaymentDismissToastRef.current) {
        toast(t('toastPaymentDismissedReserve'));
      }
      suppressPaymentDismissToastRef.current = false;
      setPaymentSession(null);
    } finally {
      queueMicrotask(() => {
        paymentDialogDismissGuardRef.current = false;
      });
    }
  }

  function bookedByLabel(row: BookingResponse): string {
    if (!userLoaded) return '…';
    if (user && row.clerkUserId === user.id) {
      return user.fullName || user.primaryEmailAddress?.emailAddress || 'You';
    }
    return row.clerkUserId;
  }

  const monthLabel = format(cursor, 'MMMM yyyy');
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, BookingResponse[]>();
    for (const b of bookings) {
      const d = format(parseISO(b.scheduledAt), 'yyyy-MM-dd');
      const arr = map.get(d) ?? [];
      arr.push(b);
      map.set(d, arr);
    }
    return map;
  }, [bookings]);

  return (
    <>
      <div className="flex min-w-0 flex-col gap-8">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">
              {t('calendarFilterTitle')}
            </h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="text-xs"
                disabled={occupancyQuery.isPending}
                onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              >
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-xs"
                disabled={occupancyQuery.isPending}
                onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              >
                Next
              </Button>
            </div>
          </div>
          <p className="mt-2 text-center text-sm font-semibold text-foreground">{monthLabel}</p>
          {occupancyQuery.isPending ? (
            <div className="mt-3 grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="flex min-h-[2.25rem] animate-pulse items-center justify-center rounded-lg border border-border/40 bg-brand-cream/50"
                >
                  <span className="h-3 w-4 rounded bg-brand-cream/70" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const hasShopBooking = occupancyByDay.get(key) ?? false;
                  const myList = bookingsByDay.get(key);
                  const myCount = myList?.length ?? 0;
                  const dayAccent = calendarDayAccentFromBookings(myList);
                  const showDot = hasShopBooking || myCount > 0;
                  const selected = selectedDay ? isSameDay(day, selectedDay) : false;
                  const inMonth = isSameMonth(day, cursor);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        'relative flex min-h-[2.25rem] flex-col items-center justify-center rounded-lg border-2 text-xs transition',
                        selected
                          ? 'border-primary bg-primary/15 font-semibold text-foreground'
                          : cn(
                              'bg-card text-foreground/80 hover:border-primary/40',
                              dayAccent?.borderUnselected ?? 'border-border/60',
                            ),
                        !inMonth && 'opacity-40',
                      )}
                    >
                      <span>{format(day, 'd')}</span>
                      {showDot ? (
                        <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              disabled={occupancyQuery.isPending}
              onClick={() => setSelectedDay(null)}
            >
              {t('showAllAppointments')}
            </Button>
            {selectedDay ? (
              <p className="text-xs text-foreground/70">
                {t('filterLabel')}{' '}
                <span className="font-semibold text-foreground">{format(selectedDay, 'PPP')}</span>
              </p>
            ) : null}
          </div>
        </Card>

        <div className="flex min-h-0 min-w-0 w-full flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">
            {t('listSectionTitle')}
          </h2>
          {isLoaded && !isSignedIn ? (
            <Card className="text-sm text-foreground/80">{t('listSignInPrompt')}</Card>
          ) : null}
          {isLoaded && isSignedIn && listQuery.isPending ? (
            <Card className="animate-pulse space-y-4 p-4">
              <div className="h-4 w-3/4 rounded bg-brand-cream/60" />
              <div className="space-y-2">
                <div className="h-3 rounded bg-brand-cream/50" />
                <div className="h-3 w-5/6 rounded bg-brand-cream/40" />
              </div>
            </Card>
          ) : null}
          {listQuery.isError ? (
            <Card className="border-red-200 bg-red-50 text-sm text-red-900">
              {safeClientErrorMessage(listQuery.error, t('listLoadError'))}
            </Card>
          ) : null}
          {isSignedIn && listQuery.data && visibleBookings.length === 0 ? (
            <Card className="text-sm text-foreground/75">
              {selectedDay ? t('emptyNoneOnDay') : t('emptyNoneYet')}
            </Card>
          ) : null}
          {isSignedIn && visibleBookings.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 scroll-smooth">
              <ul className="w-full space-y-3">
                {visibleBookings.map((row: BookingResponse) => (
                  <li key={row.id} className="min-w-0">
                    <Card className="overflow-hidden rounded p-0 shadow-sm">
                      <div className="flex min-w-0 flex-row items-start gap-4 p-4 sm:items-center sm:gap-6 sm:p-5">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p
                            className={cn(
                              'text-balance text-lg font-semibold leading-snug tracking-tight text-foreground',
                              serviceTitlePaidClass(row),
                            )}
                          >
                            {serviceLabel(row)}
                          </p>
                          <p className="text-xs text-foreground/55">
                            Booking Code{' '}
                            <span className="font-mono font-semibold tracking-wide text-foreground/90">
                              {row.bookingCode}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              className="ml-2 inline-flex h-7 gap-1.5 px-2 text-[11px] text-foreground/80"
                              onClick={() => {
                                void navigator.clipboard.writeText(row.bookingCode);
                                toast.success('Booking Code copied');
                              }}
                              aria-label="Copy booking code"
                            >
                              <ClipboardCopy
                                className="h-3.5 w-3.5 shrink-0 text-foreground/70"
                                aria-hidden
                              />
                              Copy
                            </Button>
                          </p>
                          <p className="text-sm font-medium text-foreground/90">
                            {format(parseISO(row.scheduledAt), 'EEEE, MMM d, yyyy')}
                            <span className="text-foreground/50"> · </span>
                            {format(parseISO(row.scheduledAt), 'p')}
                          </p>
                          <p className="text-xs text-foreground/55">
                            Booked by{' '}
                            <span className="font-medium text-foreground/80">{bookedByLabel(row)}</span>
                          </p>
                          <p className="text-xs text-foreground/50">
                            Last updated{' '}
                            <span className="font-medium text-foreground/70">
                              {format(parseISO(row.updatedAt), 'EEEE, MMM d, yyyy')}
                              <span className="text-foreground/40"> · </span>
                              {format(parseISO(row.updatedAt), 'p')}
                            </span>
                          </p>
                          {row.paymentStatus === BookingPaymentStatus.PARTIAL &&
                          (row.outstandingCents ?? 0) > 0 ? (
                            <p className="text-xs font-medium text-amber-900/90">
                              Outstanding: {formatStylePriceZar(row.outstandingCents)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-1.5 self-center sm:flex-nowrap sm:self-start sm:pt-0.5">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider',
                              bookingStatusBadgeClass(row.status),
                            )}
                          >
                            {formatBookingStatusLabel(row.status)}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider',
                              paymentStatusBadgeClass(row.paymentStatus),
                            )}
                          >
                            {formatPaymentStatusLabel(row.paymentStatus)}
                          </span>
                        </div>
                      </div>

                      {row.notes?.trim() ? (
                        <div className="bg-muted/25 px-4 py-3 sm:px-5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/45">
                            Notes
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-foreground/80">{row.notes}</p>
                        </div>
                      ) : null}

                      {row.status !== 'CANCELLED' && row.status !== 'SERVICED' && editingId !== row.id ? (
                        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
                          {bookingNeedsCardPayment(row) ? (
                            <Button
                              type="button"
                              variant="primary"
                              className="text-xs"
                              disabled={paymentIntentMutation.isPending}
                              onClick={() => void handlePayBooking(row)}
                            >
                              Pay now
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            className="text-xs"
                            onClick={() => setEditingId(row.id)}
                          >
                            Edit your booking
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-xs bg-red-600 text-white hover:bg-red-700 hover:text-white disabled:opacity-50"
                            disabled={cancelMutation.isPending}
                            onClick={() => setPendingCancelId(row.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : null}

                      {editingId === row.id ? (
                        <div className="px-4 pb-4 pt-3 sm:px-5">
                          <EditBookingInline
                            row={row}
                            sortedStyles={sortedStyles}
                            bookingSchedule={bookingSchedule}
                            occupiedSlotStarts={occupiedSlotStarts}
                            onSave={(payload) => updateMutation.mutate({ id: row.id, ...payload })}
                            isPending={updateMutation.isPending}
                            onClose={() => setEditingId(null)}
                            onCancelBooking={() => setPendingCancelId(row.id)}
                            cancelBookingDisabled={cancelMutation.isPending}
                          />
                        </div>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={paymentSession !== null} onOpenChange={handlePaymentDialogOpenChange}>
        <DialogContent className="flex max-h-[min(92dvh,44rem)] w-[min(100%-1.5rem,56rem)] max-w-[min(100%-1.5rem,56rem)] flex-col overflow-hidden border-border bg-background p-0">
          <DialogHeader>
            <DialogTitle>Complete payment</DialogTitle>
            <DialogDescription>
              Your time slot is held. Pay now to confirm — test card{' '}
              <span className="font-mono text-xs">4242 4242 4242 4242</span>.
            </DialogDescription>
          </DialogHeader>
          {paymentSession ? (
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-5 pt-2">
              <div className="flex flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
                <div className="space-y-3 rounded-lg border border-border bg-muted/25 p-4 text-sm md:w-[min(100%,22rem)] md:shrink-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/50">
                    Services
                  </p>
                  <ul className="space-y-2">
                    {paymentSession.serviceSummary
                      .split(' · ')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((name, i) => (
                        <li
                          key={`${name}-${i}`}
                          className="flex gap-2 text-[15px] font-semibold leading-snug text-foreground"
                        >
                          <span className="select-none text-foreground/35" aria-hidden>
                            •
                          </span>
                          <span>{name}</span>
                        </li>
                      ))}
                  </ul>
                  <p className="text-sm text-foreground/80">
                    {format(parseISO(paymentSession.scheduledAtIso), 'EEEE, MMM d, yyyy')}
                    <span className="text-foreground/50"> · </span>
                    {format(parseISO(paymentSession.scheduledAtIso), 'p')}
                  </p>
                  <p className="border-t border-border/80 pt-3 text-base font-semibold text-foreground">
                    Total due:{' '}
                    {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(
                      paymentSession.amountCents / 100,
                    )}
                  </p>
                </div>
                <div className="min-w-0 flex-1 md:py-1">
                  <BookingPaymentCheckout
                    variant="dialog"
                    className="flex min-h-0 min-w-0 flex-1 flex-col"
                    clientSecret={paymentSession.clientSecret}
                    amountCents={paymentSession.amountCents}
                    returnUrl={
                      typeof window !== 'undefined'
                        ? (() => {
                            const u = new URL(window.location.href);
                            u.searchParams.set('bookingId', paymentSession.bookingId);
                            return u.toString();
                          })()
                        : ''
                    }
                    onPaid={async () => {
                      const id = paymentSession.bookingId;
                      try {
                        await fetchAuthed<unknown>(`/bookings/${id}/payment`, {
                          method: 'PATCH',
                          body: JSON.stringify({}),
                        });
                      } catch {
                        const maxWait = 8000;
                        const start = Date.now();
                        while (Date.now() - start < maxWait) {
                          await queryClient.refetchQueries({ queryKey: queryKeys.bookings });
                          const list =
                            queryClient.getQueryData<BookingResponse[]>(queryKeys.bookings);
                          const b = list?.find((x) => x.id === id);
                          if (
                            b?.paymentStatus === BookingPaymentStatus.PAID ||
                            b?.paymentStatus === BookingPaymentStatus.PARTIAL
                          ) {
                            break;
                          }
                          await new Promise((r) => setTimeout(r, 400));
                        }
                      }
                      suppressPaymentDismissToastRef.current = true;
                      setPaymentSession(null);
                      void Promise.all([
                        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.bookingsOccupancyPrefix,
                        }),
                      ]);
                      toast.success('Payment received');
                    }}
                    onCancel={() => handlePaymentDialogOpenChange(false)}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancelId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This frees the time slot. You can book another appointment anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" className="text-xs">
                Keep booking
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="primary"
                className="text-xs"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  if (pendingCancelId) cancelMutation.mutate(pendingCancelId);
                }}
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Yes, cancel'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
