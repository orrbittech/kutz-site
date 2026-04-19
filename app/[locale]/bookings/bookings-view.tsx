'use client';

import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, ClipboardCopy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { BookingDateTimePicker } from '@/components/ui/booking-datetime-picker';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { BookingPaymentCheckout } from '@/components/bookings/booking-payment-checkout';
import { bookingNeedsCardPayment } from '@/lib/booking-payment';
import { Link, useRouter } from '@/i18n/navigation';
import { queryKeys } from '@/lib/api/query-keys';
import { publicFetch } from '@/lib/api/public-fetch';
import { safeClientErrorMessage } from '@/lib/api/safe-client-error';
import { useAuthedFetch } from '@/lib/api/use-authed-fetch';
import {
  findEarliestBookableSlotIso,
} from '@/lib/booking-hours';
import { bookingSlotStepMs, toUtcSlotStartIso } from '@/lib/booking-slot';
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
  createBookingSchema,
  parseBookingResponse,
  updateBookingSchema,
  type BookingResponse,
} from '@/lib/zod/booking';
import { styleListSchema, type StyleResponse } from '@/lib/zod/style';
import { BookingPaymentStatus, BookingStatus } from '@/lib/constants/enums';

function formatStylePriceZar(cents: number | null): string {
  if (cents == null) {
    return '—';
  }
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
}

const bookingFormSchema = z.object({
  /** ISO 8601 instant from slot picker (UTC). */
  scheduledAt: z.string().min(1, 'Pick a date and time'),
  notes: z.string().max(2000).optional(),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

const BOOKING_DRAFT_KEY = 'kutz:booking-draft';

type BookingDraftV1 = {
  scheduledAt?: string;
  /** @deprecated use scheduledAt */
  scheduledLocal?: string;
  notes?: string;
  /** @deprecated use styleIds */
  styleId?: string;
  styleIds?: string[];
  styleName?: string;
  styleNames?: string[];
};

function bookingStatusBadgeClass(status: BookingResponse['status']): string {
  switch (status) {
    case BookingStatus.PENDING:
      return 'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-300/90';
    case BookingStatus.CONFIRMED:
      return 'bg-emerald-100 text-emerald-950 ring-1 ring-inset ring-emerald-300/90';
    case BookingStatus.CANCELLED:
      return 'bg-red-100 text-red-950 ring-1 ring-inset ring-red-300/90';
    case BookingStatus.SERVICED:
      return 'bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-300/80';
    default:
      return 'bg-muted text-foreground ring-1 ring-inset ring-border';
  }
}

function formatBookingStatusLabel(status: BookingResponse['status']): string {
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

function paymentStatusBadgeClass(
  ps: BookingResponse['paymentStatus'],
): string {
  switch (ps) {
    case BookingPaymentStatus.PAID:
      return 'bg-emerald-100 text-emerald-950 ring-1 ring-inset ring-emerald-300/90';
    case BookingPaymentStatus.PARTIAL:
      return 'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-300/90';
    case BookingPaymentStatus.UNPAID:
      return 'bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-300/80';
    case BookingPaymentStatus.NOT_REQUIRED:
      return 'bg-muted text-foreground/80 ring-1 ring-inset ring-border';
    default:
      return 'bg-muted text-foreground ring-1 ring-inset ring-border';
  }
}

function formatPaymentStatusLabel(ps: BookingResponse['paymentStatus']): string {
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

function serviceTitlePaidClass(row: BookingResponse): string {
  if (row.paymentStatus === BookingPaymentStatus.PAID) {
    return 'text-emerald-800';
  }
  return '';
}

/**
 * Priority when multiple bookings share a day: PENDING → CONFIRMED → CANCELLED → SERVICED.
 * Calendar cells only (unselected); selected day uses primary border only — no second ring.
 */
function calendarDayAccentFromBookings(list: BookingResponse[] | undefined): { borderUnselected: string } | null {
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

export function BookingsView(): React.JSX.Element {
  const t = useTranslations('bookingsPage');
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const { redirectToSignIn } = useClerk();
  const fetchAuthed = useAuthedFetch();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlStyleId = searchParams.get('styleId');
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [paymentSession, setPaymentSession] = useState<{
    bookingId: string;
    clientSecret: string;
    amountCents: number;
    serviceSummary: string;
    scheduledAtIso: string;
  } | null>(null);

  const siteSettingsQuery = useQuery({
    queryKey: queryKeys.siteSettingsPublic,
    queryFn: async () => {
      const raw = await publicFetch<unknown>('/public/site-settings');
      return siteSettingsPublicSchema.parse(raw);
    },
    staleTime: 60_000,
  });

  const bookingSchedule = siteSettingsQuery.data ?? defaultSiteSettingsPublic;

  const defaultScheduledIso = useMemo(() => {
    return findEarliestBookableSlotIso(bookingSchedule, new Date(), 90);
  }, [bookingSchedule]);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { scheduledAt: defaultScheduledIso, notes: '' },
  });

  const settingsScheduleSeeded = useRef(false);
  useEffect(() => {
    if (!siteSettingsQuery.isSuccess || !siteSettingsQuery.data || settingsScheduleSeeded.current) {
      return;
    }
    settingsScheduleSeeded.current = true;
    form.setValue('scheduledAt', defaultScheduledIso);
  }, [siteSettingsQuery.isSuccess, siteSettingsQuery.data, defaultScheduledIso, form]);

  useEffect(() => {
    setSelectedStyleIds(urlStyleId ? [urlStyleId] : []);
  }, [urlStyleId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const raw = sessionStorage.getItem(BOOKING_DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as BookingDraftV1;
      form.reset({
        scheduledAt: draft.scheduledAt ?? draft.scheduledLocal ?? defaultScheduledIso,
        notes: draft.notes ?? '',
      });
      if (draft.styleIds?.length) {
        setSelectedStyleIds(draft.styleIds);
      } else if (draft.styleId) {
        setSelectedStyleIds([draft.styleId]);
      }
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem(BOOKING_DRAFT_KEY);
  }, [isLoaded, isSignedIn, defaultScheduledIso, form]);

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

  const catalogIdSet = useMemo(() => new Set(stylesQuery.data?.map((s) => s.id) ?? []), [stylesQuery.data]);

  const orderedValidStyleIds = useMemo(
    () => selectedStyleIds.filter((id) => catalogIdSet.has(id)),
    [selectedStyleIds, catalogIdSet],
  );

  const hasValidStyle = orderedValidStyleIds.length >= 1;

  const styleInvalid =
    urlStyleId != null &&
    stylesQuery.isSuccess &&
    !stylesQuery.isPending &&
    !catalogIdSet.has(urlStyleId);

  const servicesTriggerLabel = useMemo(() => {
    const picked = sortedStyles.filter((s) => selectedStyleIds.includes(s.id));
    if (picked.length === 0) return 'Choose services…';
    if (picked.length === 1) return picked[0].name;
    return `${picked.length} services`;
  }, [sortedStyles, selectedStyleIds]);

  const showBookingForm = stylesQuery.isSuccess && sortedStyles.length > 0;
  const needsStyleHint = showBookingForm && !hasValidStyle && !styleInvalid;

  const occupancyRange = useMemo(() => {
    const from = startOfMonth(cursor);
    const to = startOfMonth(addMonths(cursor, 1));
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }, [cursor]);

  const occupancyStyleKey = useMemo(() => {
    const ids =
      orderedValidStyleIds.length > 0
        ? [...orderedValidStyleIds].sort()
        : sortedStyles.map((s) => s.id).sort();
    return ids.join(',');
  }, [orderedValidStyleIds, sortedStyles]);

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

  const effectiveOccupancyStyleIds = useMemo(() => {
    if (orderedValidStyleIds.length > 0) return orderedValidStyleIds;
    return sortedStyles.map((s) => s.id);
  }, [orderedValidStyleIds, sortedStyles]);

  const occupiedSlotStarts = useMemo(() => {
    const next = new Set<string>();
    const seats = bookingSchedule.bookingConcurrentSeatsPerSlot;
    for (const row of occupancyQuery.data?.slots ?? []) {
      let full = false;
      for (const sid of effectiveOccupancyStyleIds) {
        const c = row.byStyleId[sid] ?? 0;
        if (c >= seats) {
          full = true;
          break;
        }
      }
      if (full) next.add(row.slotStart);
    }
    return next;
  }, [occupancyQuery.data, effectiveOccupancyStyleIds, bookingSchedule.bookingConcurrentSeatsPerSlot]);

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

  const createMutation = useMutation({
    mutationFn: async (input: { scheduledAt: string; notes?: string; styleIds: string[] }) => {
      const raw = await fetchAuthed<unknown>('/bookings', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return bookingResponseSchema.parse(raw);
    },
    onSuccess: async (data: unknown) => {
      const created = parseBookingResponse(data);
      try {
        sessionStorage.removeItem(BOOKING_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      queryClient.setQueryData<BookingResponse[]>(queryKeys.bookings, (prev) => {
        if (!prev) return [created];
        return [created, ...prev];
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bookingsOccupancyPrefix }),
      ]);

      const nextSlotIso = findEarliestBookableSlotIso(bookingSchedule, new Date(), 90);
      form.reset({ scheduledAt: nextSlotIso, notes: '' });
      setSelectedStyleIds(urlStyleId ? [urlStyleId] : []);

      if (bookingNeedsCardPayment(created)) {
        try {
          const pi = await paymentIntentMutation.mutateAsync(created.id);
          const summary =
            created.styles?.map((s) => s.name).join(' · ') ?? created.styleName ?? 'Appointment';
          setPaymentSession({
            bookingId: created.id,
            clientSecret: pi.clientSecret,
            amountCents: pi.amountCents,
            serviceSummary: summary,
            scheduledAtIso: created.scheduledAt,
          });
          toast.success('Booking reserved — complete payment in the dialog.');
        } catch (err: unknown) {
          toast.error(`❌ ${safeClientErrorMessage(err, 'Could not start payment')}`);
          toast.success('Booking reserved — use Pay now on the booking when you are ready.');
        }
      } else {
        toast.success('✅ Booking confirmed');
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Could not create booking';
      toast.error(`❌ ${msg}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      scheduledAt?: string;
      notes?: string;
      styleIds?: string[];
    }) => {
      const body = updateBookingSchema.parse({
        scheduledAt: input.scheduledAt,
        notes: input.notes,
        styleIds: input.styleIds,
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

  function onSubmit(values: BookingFormValues): void {
    if (!isLoaded) return;
    if (!hasValidStyle || orderedValidStyleIds.length < 1) {
      toast.error('Choose at least one service before booking.');
      return;
    }
    const namesForDraft = orderedValidStyleIds
      .map((id) => sortedStyles.find((s) => s.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    if (!isSignedIn) {
      try {
        const draftPayload: BookingDraftV1 = {
          scheduledAt: values.scheduledAt,
          notes: values.notes ?? '',
          styleIds: orderedValidStyleIds,
          styleNames: namesForDraft,
        };
        sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(draftPayload));
      } catch {
        /* ignore */
      }
      void redirectToSignIn({ redirectUrl: typeof window !== 'undefined' ? window.location.href : undefined });
      return;
    }
    const scheduledAt = new Date(values.scheduledAt);
    const payload = createBookingSchema.parse({
      scheduledAt: scheduledAt.toISOString(),
      notes: values.notes?.trim() ? values.notes : undefined,
      styleIds: orderedValidStyleIds,
    });
    createMutation.mutate(payload);
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
      setPaymentSession(null);
      const next = new URL(window.location.href);
      next.searchParams.delete('payment_intent');
      next.searchParams.delete('payment_intent_client_secret');
      next.searchParams.delete('redirect_status');
      next.searchParams.delete('bookingId');
      router.replace(`${next.pathname}${next.search}`);
    })();
  }, [
    stripeRedirectStatus,
    stripeReturnBookingId,
    queryClient,
    router,
    fetchAuthed,
  ]);

  async function handlePayBooking(row: BookingResponse): Promise<void> {
    try {
      const pi = await paymentIntentMutation.mutateAsync(row.id);
      const summary =
        row.styles?.map((s) => s.name).join(' · ') ?? row.styleName ?? 'Appointment';
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

  function bookedByLabel(row: BookingResponse): string {
    if (!userLoaded) return '…';
    if (user && row.clerkUserId === user.id) {
      return user.fullName || user.primaryEmailAddress?.emailAddress || 'You';
    }
    return row.clerkUserId;
  }

  function serviceLabel(row: BookingResponse): string {
    if (row.styles?.length) {
      return row.styles.map((s) => s.name).join(' · ');
    }
    return row.style?.name ?? row.styleName ?? '—';
  }

  const submitDisabled =
    !isLoaded ||
    createMutation.isPending ||
    !hasValidStyle ||
    orderedValidStyleIds.length < 1 ||
    (stylesQuery.isPending && selectedStyleIds.length > 0);

  return (
    <>
      <div className="flex min-w-0 flex-col gap-8">
        <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="min-w-0 space-y-8">
            <Card>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">New booking</h2>
            <p className="mt-2 max-w-prose text-xs leading-relaxed text-foreground/70">{t('reminderNote')}</p>

            {stylesQuery.isPending ? (
              <p className="mt-4 text-sm text-foreground/75">Loading styles…</p>
            ) : null}

            {stylesQuery.isError ? (
              <Card className="mt-4 border-red-200 bg-red-50 text-sm text-red-900">
                Could not load styles.{' '}
                {safeClientErrorMessage(stylesQuery.error, 'Unknown error')}
              </Card>
            ) : null}

            {styleInvalid ? (
              <p className="mt-4 text-sm text-foreground/85">
                This service link is invalid or no longer available. Choose a valid style below.
              </p>
            ) : null}

            {stylesQuery.isSuccess && sortedStyles.length === 0 ? (
              <Card className="mt-4 text-sm text-foreground/80">
                No styles available yet. Check back soon or contact the shop.
              </Card>
            ) : null}

            {needsStyleHint ? (
              <p className="mt-4 text-sm text-foreground/85">
                Pick a style and time below, or{' '}
                <Link href="/styles" className="font-semibold text-foreground underline underline-offset-2">
                  browse the full menu
                </Link>{' '}
                for photos and details.
              </p>
            ) : null}

            {showBookingForm ? (
              <form
                className={cn('space-y-4', needsStyleHint || styleInvalid ? 'mt-4' : 'mt-6')}
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <div className="space-y-2">
                  <span
                    id="booking-services-label"
                    className="block text-xs font-semibold uppercase tracking-wide text-foreground/70"
                  >
                    Services
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex h-auto min-h-[2.75rem] w-full justify-between gap-2 whitespace-normal py-2 text-left font-normal normal-case"
                        aria-invalid={styleInvalid ? true : undefined}
                        aria-labelledby="booking-services-label"
                      >
                        <span className="line-clamp-2 flex-1">{servicesTriggerLabel}</span>
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
                          checked={selectedStyleIds.includes(s.id)}
                          onCheckedChange={(checked) => {
                            setSelectedStyleIds((prev) => {
                              if (checked) return prev.includes(s.id) ? prev : [...prev, s.id];
                              return prev.filter((id) => id !== s.id);
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
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="scheduledAt"
                    className="text-xs font-semibold uppercase tracking-wide text-foreground/70"
                  >
                    Date &amp; time
                  </label>
                  <Controller
                    control={form.control}
                    name="scheduledAt"
                    render={({ field }) => (
                      <BookingDateTimePicker
                        id="scheduledAt"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        bookingTimeZone={bookingSchedule.bookingTimeZone}
                        bookingHours={bookingSchedule.bookingHours}
                        slotStepMinutes={bookingSchedule.bookingSlotStepMinutes}
                        slotStepMs={bookingSlotStepMs(bookingSchedule)}
                        occupiedSlotStarts={occupiedSlotStarts}
                        aria-invalid={!!form.formState.errors.scheduledAt}
                        aria-describedby={form.formState.errors.scheduledAt ? 'scheduledAt-error' : undefined}
                      />
                    )}
                  />
                  {form.formState.errors.scheduledAt?.message ? (
                    <p id="scheduledAt-error" className="text-xs text-red-600" role="alert">
                      {form.formState.errors.scheduledAt.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={4}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Allergies, preferred barber, parking needs…"
                    {...form.register('notes')}
                  />
                  {form.formState.errors.notes?.message ? (
                    <p id="notes-error" className="text-xs text-red-600" role="alert">
                      {form.formState.errors.notes.message}
                    </p>
                  ) : null}
                </div>
                {!isSignedIn && isLoaded ? (
                  <p className="text-xs text-foreground/70">
                    Sign in to finalize your booking — we keep your date, services, and notes when you continue.
                  </p>
                ) : null}
                <Button type="submit" disabled={submitDisabled}>
                  {createMutation.isPending
                    ? 'Saving…'
                    : !isSignedIn && isLoaded
                      ? 'Sign in to book now'
                      : 'Book now'}
                </Button>
              </form>
            ) : null}
            </Card>

          </div>

          <div className="space-y-6">
            <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">Calendar</h2>
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
            <p className="text-center text-sm font-semibold text-foreground">{monthLabel}</p>
            {occupancyQuery.isPending ? (
              <>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
                  {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex min-h-[2.25rem] animate-pulse items-center justify-center rounded-lg border border-border/40 bg-brand-cream/50"
                    >
                      <span className="h-3 w-4 rounded bg-brand-cream/70" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                disabled={occupancyQuery.isPending}
                onClick={() => setSelectedDay(null)}
              >
                Show all
              </Button>
              {selectedDay ? (
                <p className="text-xs text-foreground/70">
                  Filter: <span className="font-semibold text-foreground">{format(selectedDay, 'PPP')}</span>
                </p>
              ) : null}
            </div>
          </Card>
        </div>
        </div>

        {/* Tall list column: ~10rem approximates header + main padding/title above BookingsView */}
        <div className="flex min-h-0 min-w-0 w-full flex-col gap-4 lg:min-h-[calc(100dvh-var(--header-height)-10rem)] lg:max-h-[calc(100dvh-var(--header-height)-10rem)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">Your bookings</h2>
            {isLoaded && !isSignedIn ? (
              <Card className="text-sm text-foreground/80">
                Sign in to see your schedule, reschedule, or cancel appointments.
              </Card>
            ) : null}
            {isLoaded && isSignedIn && listQuery.isPending ? (
              <Card className="animate-pulse space-y-4 p-4">
                <div className="h-4 w-3/4 rounded bg-brand-cream/60" />
                <div className="space-y-2">
                  <div className="h-3 rounded bg-brand-cream/50" />
                  <div className="h-3 w-5/6 rounded bg-brand-cream/40" />
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="h-8 w-24 rounded-md bg-brand-cream/50" />
                  <div className="h-8 w-16 rounded-md bg-brand-cream/40" />
                </div>
              </Card>
            ) : null}
            {listQuery.isError ? (
              <Card className="border-red-200 bg-red-50 text-sm text-red-900">
                {safeClientErrorMessage(listQuery.error, 'Failed to load bookings')}
              </Card>
            ) : null}
            {isSignedIn && listQuery.data && visibleBookings.length === 0 ? (
              <Card className="text-sm text-foreground/75">
                {selectedDay ? 'No bookings on this day.' : 'No bookings yet — add your first from the left after picking a style and time.'}
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

      <Dialog
        open={paymentSession !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentSession(null);
        }}
      >
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
                      setPaymentSession(null);
                      void Promise.all([
                        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.bookingsOccupancyPrefix,
                        }),
                      ]);
                      toast.success('Payment received');
                    }}
                    onCancel={() => setPaymentSession(null)}
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

function initialEditStyleIds(row: BookingResponse): string[] {
  const fromStyles = row.styles?.map((s) => s.id) ?? [];
  if (fromStyles.length > 0) return fromStyles;
  return row.styleId ? [row.styleId] : [];
}

function EditBookingInline({
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
    styleIds?: string[];
  }) => void;
  isPending: boolean;
  onClose: () => void;
  onCancelBooking: () => void;
  cancelBookingDisabled: boolean;
}): React.JSX.Element {
  const editSlotStepMs = bookingSlotStepMs(bookingSchedule);
  const extraAvailableSlotStarts = useMemo(
    () => new Set<string>([toUtcSlotStartIso(parseISO(row.scheduledAt), editSlotStepMs)]),
    [row.scheduledAt, editSlotStepMs],
  );
  const localDefault = parseISO(row.scheduledAt).toISOString();
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>(() => initialEditStyleIds(row));

  const catalogIdSet = useMemo(() => new Set(sortedStyles.map((s) => s.id)), [sortedStyles]);
  const orderedValidStyleIds = useMemo(
    () => selectedStyleIds.filter((id) => catalogIdSet.has(id)),
    [selectedStyleIds, catalogIdSet],
  );

  const editServicesTriggerLabel = useMemo(() => {
    const picked = sortedStyles.filter((s) => selectedStyleIds.includes(s.id));
    if (picked.length === 0) return 'Choose services…';
    if (picked.length === 1) return picked[0].name;
    return `${picked.length} services`;
  }, [sortedStyles, selectedStyleIds]);

  const form = useForm({
    resolver: zodResolver(
      z.object({
        scheduledAt: z.string().min(1),
        notes: z.string().max(2000).optional(),
      }),
    ),
    defaultValues: { scheduledAt: localDefault, notes: row.notes },
  });

  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit((values) => {
        if (orderedValidStyleIds.length < 1) {
          toast.error('Pick at least one service.');
          return;
        }
        const scheduledAt = new Date(values.scheduledAt).toISOString();
        onSave({
          scheduledAt,
          notes: values.notes?.trim() ? values.notes : '',
          styleIds: orderedValidStyleIds,
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
                checked={selectedStyleIds.includes(s.id)}
                onCheckedChange={(checked) => {
                  setSelectedStyleIds((prev) => {
                    if (checked) return prev.includes(s.id) ? prev : [...prev, s.id];
                    return prev.filter((id) => id !== s.id);
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
              bookingTimeZone={bookingSchedule.bookingTimeZone}
              bookingHours={bookingSchedule.bookingHours}
              slotStepMinutes={bookingSchedule.bookingSlotStepMinutes}
              slotStepMs={bookingSlotStepMs(bookingSchedule)}
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
