'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function formatZar(cents: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(
    cents / 100,
  );
}

function PaymentForm({
  amountCents,
  returnUrl,
  onPaid,
  onCancel,
  variant,
}: {
  amountCents: number;
  returnUrl: string;
  onPaid: () => void;
  onCancel: () => void;
  variant: 'card' | 'dialog';
}): React.JSX.Element {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });
      if (error) {
        toast.error(error.message ?? 'Payment could not be completed');
        return;
      }
      onPaid();
    } finally {
      setBusy(false);
    }
  }

  const shell =
    variant === 'dialog'
      ? 'rounded-lg border border-neutral-200 bg-white p-4 shadow-sm'
      : '';

  return (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      {variant === 'card' ? (
        <p className="text-sm text-foreground/85">
          Total due: <span className="font-semibold text-foreground">{formatZar(amountCents)}</span>
        </p>
      ) : null}
      <div className={shell}>
        <PaymentElement />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy || !stripe}>
          {busy ? 'Processing…' : 'Pay now'}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function BookingPaymentCheckout({
  clientSecret,
  amountCents,
  returnUrl,
  onPaid,
  onCancel,
  variant = 'card',
  className,
}: {
  clientSecret: string;
  amountCents: number;
  returnUrl: string;
  onPaid: () => void;
  onCancel: () => void;
  /** `dialog`: white Stripe block for modal overlay */
  variant?: 'card' | 'dialog';
  /** Merged onto the dialog variant wrapper (e.g. flex column in a grid). */
  className?: string;
}): React.JSX.Element {
  if (!stripePromise) {
    return (
      <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Payments are not configured. Add{' '}
        <code className="rounded bg-amber-100/80 px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to
        your environment.
      </Card>
    );
  }

  const inner = (
    <>
      {variant === 'card' ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70">
            Complete payment
          </p>
          <p className="mt-1 text-sm text-foreground/80">
            Your time slot is held. Pay now to confirm — test card{' '}
            <span className="font-mono text-xs">4242 4242 4242 4242</span>.
          </p>
        </div>
      ) : null}
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <PaymentForm
          amountCents={amountCents}
          returnUrl={returnUrl}
          onPaid={onPaid}
          onCancel={onCancel}
          variant={variant}
        />
      </Elements>
    </>
  );

  if (variant === 'dialog') {
    return (
      <div className={cn('min-h-0 min-w-0 space-y-4 px-1 pb-1', className)}>{inner}</div>
    );
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      {inner}
    </Card>
  );
}
