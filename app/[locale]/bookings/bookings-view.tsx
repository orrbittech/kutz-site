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
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Controller, useForm, useWatch } from 'react-hook-form';
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
import {
  BookingOrderSummaryCard,
  type StyleLineDraft,
} from '@/components/bookings/booking-order-summary-card';
import { cn } from '@/lib/cn';
import { bookingNeedsCardPayment } from '@/lib/booking-payment';
import { Link, useRouter } from '@/i18n/navigation';
import { queryKeys } from '@/lib/api/query-keys';
import { publicFetch } from '@/lib/api/public-fetch';
import { safeClientErrorMessage } from '@/lib/api/safe-client-error';
import { useAuthedFetch } from '@/lib/api/use-authed-fetch';
import {
  findEarliestBookableSlotIso,
} from '@/lib/booking-hours';
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
  createBookingSchema,
  parseBookingResponse,
  type BookingResponse,
} from '@/lib/zod/booking';
import { styleListSchema, type StyleResponse } from '@/lib/zod/style';
import { calendarDayAccentFromBookings, formatStylePriceZar } from '@/lib/booking-ui';
import { BookingPaymentStatus, BookingStatus } from '@/lib/constants/enums';

const BookingPaymentCheckout = dynamic(
  () =>
    import('@/components/bookings/booking-payment-checkout').then((m) => m.BookingPaymentCheckout),
  { ssr: false },
);

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
  /** @deprecated use styleLineItems */
  styleId?: string;
  /** @deprecated use styleLineItems */
  styleIds?: string[];
  styleLineItems?: StyleLineDraft[];
  styleName?: string;
  styleNames?: string[];
};

/** Second success toast so it appears after the first (readable stack). */
function toastSuccessAfterFrame(message: string, delayMs = 320): void {
  if (typeof window === 'undefined') {
    toast.success(message);
    return;
  }
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      toast.success(message);
    }, delayMs);
  });
}

export function BookingsView(): React.JSX.Element {
  const reduceMotion = useReducedMotion();
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
  const [pendingRemoveStyleId, setPendingRemoveStyleId] = useState<string | null>(null);
  const [styleLines, setStyleLines] = useState<StyleLineDraft[]>([]);
  /** Bumps after a successful create so the new-booking `<form>` remounts and controls stay in sync with `reset`. */
  const [bookingFormResetKey, setBookingFormResetKey] = useState(0);
  const [paymentSession, setPaymentSession] = useState<{
    bookingId: string;
    clientSecret: string;
    amountCents: number;
    serviceSummary: string;
    scheduledAtIso: string;
  } | null>(null);
  /** When true, closing the payment dialog must not show the "please pay" dismiss toast (paid or Stripe return). */
  const suppressPaymentDismissToastRef = useRef(false);
  /** Prevents duplicate dismiss handling when both Radix `onOpenChange` and Cancel run in one close. */
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

  const defaultScheduledIso = useMemo(() => {
    return findEarliestBookableSlotIso(bookingSchedule, new Date(), 90);
  }, [bookingSchedule]);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { scheduledAt: defaultScheduledIso, notes: '' },
  });

  const watchedScheduledAt = useWatch({ control: form.control, name: 'scheduledAt' }) ?? '';
  const watchedNotes = useWatch({ control: form.control, name: 'notes' }) ?? '';

  const purchaseClientDisplay = useMemo(() => {
    if (!userLoaded || !isLoaded) return '…';
    if (!isSignedIn) return '';
    return user?.fullName || user?.primaryEmailAddress?.emailAddress || 'You';
  }, [userLoaded, isLoaded, isSignedIn, user]);

  const settingsScheduleSeeded = useRef(false);
  useEffect(() => {
    if (!siteSettingsQuery.isSuccess || !siteSettingsQuery.data || settingsScheduleSeeded.current) {
      return;
    }
    settingsScheduleSeeded.current = true;
    form.setValue('scheduledAt', defaultScheduledIso);
  }, [siteSettingsQuery.isSuccess, siteSettingsQuery.data, defaultScheduledIso, form]);

  useEffect(() => {
    setStyleLines(urlStyleId ? [{ styleId: urlStyleId, quantity: 1 }] : []);
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
      if (draft.styleLineItems?.length) {
        setStyleLines(draft.styleLineItems);
      } else if (draft.styleIds?.length) {
        setStyleLines(draft.styleIds.map((id) => ({ styleId: id, quantity: 1 })));
      } else if (draft.styleId) {
        setStyleLines([{ styleId: draft.styleId, quantity: 1 }]);
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

  const orderedValidStyleLines = useMemo(
    () =>
      styleLines.filter(
        (line) => catalogIdSet.has(line.styleId) && line.quantity >= 1,
      ),
    [styleLines, catalogIdSet],
  );

  const hasValidStyle = orderedValidStyleLines.length >= 1;

  const styleInvalid =
    urlStyleId != null &&
    stylesQuery.isSuccess &&
    !stylesQuery.isPending &&
    !catalogIdSet.has(urlStyleId);

  const servicesTriggerLabel = useMemo(() => {
    const picked = sortedStyles.filter((s) =>
      orderedValidStyleLines.some((l) => l.styleId === s.id),
    );
    if (picked.length === 0) return 'Choose services…';
    if (picked.length === 1) return picked[0].name;
    return `${picked.length} services`;
  }, [sortedStyles, orderedValidStyleLines]);

  const showBookingForm = stylesQuery.isSuccess && sortedStyles.length > 0;
  const needsStyleHint = showBookingForm && !hasValidStyle && !styleInvalid;

  const occupancyRange = useMemo(() => {
    const from = startOfMonth(cursor);
    const to = startOfMonth(addMonths(cursor, 1));
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }, [cursor]);

  const occupancyStyleKey = useMemo(() => {
    const ids =
      orderedValidStyleLines.length > 0
        ? [...new Set(orderedValidStyleLines.map((l) => l.styleId))].sort()
        : sortedStyles.map((s) => s.id).sort();
    return ids.join(',');
  }, [orderedValidStyleLines, sortedStyles]);

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
    if (orderedValidStyleLines.length > 0) {
      return [...new Set(orderedValidStyleLines.map((l) => l.styleId))];
    }
    return sortedStyles.map((s) => s.id);
  }, [orderedValidStyleLines, sortedStyles]);

  const lineQtyByStyleId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of orderedValidStyleLines) {
      m[l.styleId] = l.quantity;
    }
    return m;
  }, [orderedValidStyleLines]);

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

  const createMutation = useMutation({
    mutationFn: async (input: {
      scheduledAt: string;
      notes?: string;
      styleLineItems: StyleLineDraft[];
    }) => {
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

      const nextSlotIso = findEarliestBookableSlotIso(bookingSchedule, new Date(), 90);
      form.reset(
        { scheduledAt: nextSlotIso, notes: '' },
        { keepDefaultValues: false },
      );
      setStyleLines(urlStyleId ? [{ styleId: urlStyleId, quantity: 1 }] : []);
      setBookingFormResetKey((k) => k + 1);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.bookingsOccupancyPrefix }),
      ]);

      if (bookingNeedsCardPayment(created)) {
        try {
          const pi = await paymentIntentMutation.mutateAsync(created.id);
          const summary =
            created.styles
              ?.map((s) =>
                (s.quantity ?? 1) > 1 ? `${s.name} × ${s.quantity}` : s.name,
              )
              .join(' · ') ?? created.styleName ?? 'Appointment';
          setPaymentSession({
            bookingId: created.id,
            clientSecret: pi.clientSecret,
            amountCents: pi.amountCents,
            serviceSummary: summary,
            scheduledAtIso: created.scheduledAt,
          });
          toast.success(t('toastBookingCreatedHeld'));
          toastSuccessAfterFrame(t('toastPaymentCompleteInDialog'));
        } catch (err: unknown) {
          toast.error(`❌ ${safeClientErrorMessage(err, 'Could not start payment')}`);
          toast.success(t('toastBookingCreatedHeld'));
          toastSuccessAfterFrame(t('toastPaymentUsePayNow'));
        }
      } else {
        toast.success(t('toastBookingConfirmed'));
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Could not create booking';
      toast.error(`❌ ${msg}`);
    },
  });

  function onSubmit(values: BookingFormValues): void {
    if (!isLoaded) return;
    if (!hasValidStyle || orderedValidStyleLines.length < 1) {
      toast.error('Choose at least one service before booking.');
      return;
    }
    const namesForDraft = orderedValidStyleLines
      .map((line) => sortedStyles.find((s) => s.id === line.styleId)?.name)
      .filter((n): n is string => Boolean(n));
    if (!isSignedIn) {
      try {
        const draftPayload: BookingDraftV1 = {
          scheduledAt: values.scheduledAt,
          notes: values.notes ?? '',
          styleLineItems: orderedValidStyleLines,
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
      styleLineItems: orderedValidStyleLines,
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
  }, [
    stripeRedirectStatus,
    stripeReturnBookingId,
    queryClient,
    router,
    fetchAuthed,
  ]);

  function confirmRemoveServiceFromCart(): void {
    if (pendingRemoveStyleId == null) return;
    const removeId = pendingRemoveStyleId;
    setPendingRemoveStyleId(null);
    const nextLines = styleLines.filter((l) => l.styleId !== removeId);
    setStyleLines(nextLines);
    const urlSid = searchParams.get('styleId');
    if (urlSid && !nextLines.some((l) => l.styleId === urlSid) && typeof window !== 'undefined') {
      const next = new URL(window.location.href);
      next.searchParams.delete('styleId');
      router.replace(`${next.pathname}${next.search}`);
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

  function handleCartQuantityChange(styleId: string, nextQty: number): void {
    if (nextQty < 1) {
      setPendingRemoveStyleId(styleId);
      return;
    }
    setStyleLines((prev) =>
      prev.map((l) =>
        l.styleId === styleId ? { ...l, quantity: Math.min(99, nextQty) } : l,
      ),
    );
  }

  const submitDisabled =
    !isLoaded ||
    createMutation.isPending ||
    !hasValidStyle ||
    orderedValidStyleLines.length < 1 ||
    (stylesQuery.isPending && styleLines.length > 0);

  return (
    <>
      <div className="flex min-w-0 flex-col gap-8">
        <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:items-stretch lg:min-h-0 lg:max-h-[calc(100dvh-var(--header-height)-9rem)] lg:grid-rows-[minmax(0,1fr)]">
          <div className="flex min-h-0 min-w-0 flex-col lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <Card className="flex h-full min-h-0 flex-col">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">{t('formSectionTitle')}</h2>
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
                key={bookingFormResetKey}
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
                          checked={styleLines.some((l) => l.styleId === s.id)}
                          onCheckedChange={(checked) => {
                            setStyleLines((prev) => {
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
                    rows={8}
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

          <div className="flex min-h-0 min-w-0 flex-col lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            {orderedValidStyleLines.length > 0 ? (
              <BookingOrderSummaryCard
                styleLineItems={orderedValidStyleLines}
                sortedStyles={sortedStyles}
                scheduledAtIso={watchedScheduledAt}
                notes={watchedNotes}
                businessName={bookingSchedule.businessName}
                clientDisplayName={purchaseClientDisplay}
                clientAvatarUrl={
                  userLoaded && isLoaded && isSignedIn ? user?.imageUrl : undefined
                }
                onRequestRemoveStyle={(styleId) => setPendingRemoveStyleId(styleId)}
                onChangeQuantity={handleCartQuantityChange}
                className="min-h-0 flex-1"
              />
            ) : (
              <Card className="flex h-full min-h-0 flex-col space-y-4">
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
                        <motion.div
                          key={i}
                          className="flex min-h-[2.25rem] items-center justify-center rounded-lg border border-border/40 bg-brand-cream/50"
                          aria-hidden
                          initial={false}
                          animate={
                            reduceMotion
                              ? { opacity: 1 }
                              : { opacity: [0.45, 1, 0.45] }
                          }
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                          }
                        >
                          <span className="h-3 w-4 rounded bg-brand-cream/70" />
                        </motion.div>
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
                        const inMonth = isSameMonth(day, cursor);
                        return (
                          <motion.button
                            key={key}
                            type="button"
                            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                            className={cn(
                              'relative flex min-h-[2.25rem] flex-col items-center justify-center rounded-lg border-2 text-xs',
                              cn(
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
                          </motion.button>
                        );
                      })}
                    </div>
                  </>
                )}
              </Card>
            )}
        </div>
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
        open={pendingRemoveStyleId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveStyleId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeServiceConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('removeServiceConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" className="text-xs">
                {t('removeServiceCancel')}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="primary" className="text-xs" onClick={confirmRemoveServiceFromCart}>
                {t('removeServiceConfirm')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
