'use client';

import { useAuth, useClerk } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { queryKeys } from '@/lib/api/query-keys';
import { safeClientErrorMessage } from '@/lib/api/safe-client-error';
import { useAuthedFetch } from '@/lib/api/use-authed-fetch';
import { BookingStatus } from '@/lib/constants/enums';
import { bookingListSchema, type BookingResponse } from '@/lib/zod/booking';
import {
  createOrderSchema,
  orderListSchema,
  orderResponseSchema,
} from '@/lib/zod/order';

const orderFormSchema = z.object({
  itemName: z.string().min(1, 'Add an item name'),
  quantity: z.coerce.number().int().positive(),
  unitPriceCents: z.coerce.number().int().nonnegative(),
  notes: z.string().max(2000).optional(),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });

function OrdersListSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="animate-pulse space-y-3 p-4">
          <div className="flex justify-between gap-3">
            <div className="h-4 w-24 rounded bg-brand-cream/60" />
            <div className="h-4 w-16 rounded bg-brand-cream/40" />
          </div>
          <div className="h-3 w-full rounded bg-brand-cream/40" />
          <div className="h-3 w-2/3 rounded bg-brand-cream/30" />
        </Card>
      ))}
    </div>
  );
}

export function OrdersView(): React.JSX.Element {
  const { isSignedIn, isLoaded } = useAuth();
  const { redirectToSignIn } = useClerk();
  const fetchAuthed = useAuthedFetch();
  const queryClient = useQueryClient();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      itemName: 'Classic cut',
      quantity: 1,
      unitPriceCents: 4500,
      notes: '',
    },
  });

  const listQuery = useQuery({
    queryKey: queryKeys.orders,
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const raw = await fetchAuthed<unknown>('/orders');
      return orderListSchema.parse(raw);
    },
  });

  const bookingsQuery = useQuery({
    queryKey: queryKeys.bookings,
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const raw = await fetchAuthed<unknown>('/bookings');
      return bookingListSchema.parse(raw) as BookingResponse[];
    },
  });

  const servicedVisits = useMemo(() => {
    const list = bookingsQuery.data ?? [];
    return [...list]
      .filter((b) => b.status === BookingStatus.SERVICED)
      .sort((a, b) => parseISO(b.scheduledAt).getTime() - parseISO(a.scheduledAt).getTime());
  }, [bookingsQuery.data]);

  function serviceLabel(row: (typeof servicedVisits)[number]): string {
    if (row.styles?.length) {
      return row.styles.map((s) => s.name).join(' · ');
    }
    return row.style?.name ?? row.styleName ?? '—';
  }

  const createMutation = useMutation({
    mutationFn: async (input: z.infer<typeof createOrderSchema>) => {
      const raw = await fetchAuthed<unknown>('/orders', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return orderResponseSchema.parse(raw);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    },
  });

  function onSubmit(values: OrderFormValues): void {
    if (!isLoaded) return;
    if (!isSignedIn) {
      void redirectToSignIn({ redirectUrl: typeof window !== 'undefined' ? window.location.href : undefined });
      return;
    }
    const payload = createOrderSchema.parse({
      lineItems: [
        {
          name: values.itemName.trim(),
          quantity: values.quantity,
          unitPriceCents: values.unitPriceCents,
        },
      ],
      notes: values.notes?.trim() ? values.notes : undefined,
    });
    createMutation.mutate(payload);
  }

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-2">
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">New order</h2>
        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground/70" htmlFor="itemName">
                Item
              </label>
              <input
                id="itemName"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                {...form.register('itemName')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground/70" htmlFor="quantity">
                Qty
              </label>
              <input
                id="quantity"
                type="number"
                min={1}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                {...form.register('quantity')}
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-xs font-semibold uppercase tracking-wide text-foreground/70"
                htmlFor="unitPriceCents"
              >
                Unit (cents)
              </label>
              <input
                id="unitPriceCents"
                type="number"
                min={0}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                {...form.register('unitPriceCents')}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground/70" htmlFor="notes">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                rows={3}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                {...form.register('notes')}
              />
            </div>
          </div>
          {createMutation.isError ? (
            <p className="text-sm text-red-700">
              {safeClientErrorMessage(createMutation.error, 'Could not create order')}
            </p>
          ) : null}
          <Button type="submit" disabled={!isLoaded || createMutation.isPending}>
            {createMutation.isPending ? 'Saving…' : !isSignedIn && isLoaded ? 'Sign in to create order' : 'Create order'}
          </Button>
          {!isSignedIn && isLoaded ? (
            <p className="text-xs text-foreground/70">Sign in to save orders to your account.</p>
          ) : null}
        </form>
      </Card>

      <div className="space-y-4">
        {isLoaded && !isSignedIn ? (
          <Card className="text-sm text-foreground/80">
            Sign in to see completed visits from your bookings and your purchase orders.
          </Card>
        ) : null}
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">Completed visits</h2>
        {isSignedIn && bookingsQuery.isPending ? (
          <Card className="animate-pulse space-y-2 p-4">
            <div className="h-4 w-40 rounded bg-brand-cream/60" />
            <div className="h-3 w-full rounded bg-brand-cream/40" />
          </Card>
        ) : null}
        {isSignedIn && bookingsQuery.isError ? (
          <Card className="border-red-200 bg-red-50 text-sm text-red-900">
            {safeClientErrorMessage(bookingsQuery.error, 'Failed to load visits')}
          </Card>
        ) : null}
        {isSignedIn && bookingsQuery.data && servicedVisits.length === 0 ? (
          <Card className="text-sm text-foreground/75">No completed visits yet.</Card>
        ) : null}
        {isSignedIn && servicedVisits.length > 0 ? (
          <ul className="space-y-3">
            {servicedVisits.map((row) => (
              <Card key={row.id} className="space-y-1 p-4">
                <p className="text-sm font-semibold text-foreground">{serviceLabel(row)}</p>
                <p className="text-xs text-foreground/75">
                  {format(parseISO(row.scheduledAt), 'EEEE, MMM d, yyyy')}
                  <span className="text-foreground/45"> · </span>
                  {format(parseISO(row.scheduledAt), 'p')}
                </p>
              </Card>
            ))}
          </ul>
        ) : null}

        <h2 className="pt-4 text-sm font-semibold uppercase tracking-[0.2em] text-foreground/70">Your orders</h2>
        {isSignedIn && listQuery.isPending ? <OrdersListSkeleton /> : null}
        {isSignedIn && listQuery.isError ? (
          <Card className="border-red-200 bg-red-50 text-sm text-red-900">
            {safeClientErrorMessage(listQuery.error, 'Failed to load orders')}
          </Card>
        ) : null}
        {isSignedIn && listQuery.data && listQuery.data.length === 0 ? (
          <Card className="text-sm text-foreground/75">No orders yet.</Card>
        ) : null}
        {isSignedIn && listQuery.data && listQuery.data.length > 0 ? (
          <ul className="space-y-3">
            {listQuery.data.map((row) => (
              <Card key={row.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-wide">{row.status}</p>
                  <p className="text-sm tabular-nums text-foreground/80">{zar.format(row.totalCents / 100)}</p>
                </div>
                <ul className="text-sm text-foreground/75">
                  {row.lineItems.map((line) => (
                    <li key={`${row.id}-${line.name}-${line.quantity}`}>
                      {line.name} × {line.quantity}
                    </li>
                  ))}
                </ul>
                {row.notes ? <p className="text-sm text-foreground/75">{row.notes}</p> : null}
              </Card>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
