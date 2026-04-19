'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { publicFetch } from '@/lib/api/public-fetch';
import { queryKeys } from '@/lib/api/query-keys';
import { safeClientErrorMessage } from '@/lib/api/safe-client-error';
import { useAuthedFetch } from '@/lib/api/use-authed-fetch';
import {
  bookingHoursSpecSchema,
  patchSiteSettingsSchema,
  siteSettingsPublicSchema,
  type PatchSiteSettingsInput,
  type SiteSettingsPublic,
} from '@/lib/zod/site-settings';

const BOOKING_TIME_ZONES = [
  'Africa/Johannesburg',
  'UTC',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Australia/Sydney',
] as const;

const inputClass =
  'w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

type FormValues = {
  businessName: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  publicEmail: string;
  latitude: string;
  longitude: string;
  openingHoursText: string;
  bookingTimeZone: string;
  bookingHoursJson: string;
  bookingSessionMinutes: string;
  bookingBreakMinutes: string;
  bookingConcurrentSeatsPerSlot: string;
  defaultLocale: string;
  smsBookingNotificationsEnabled: boolean;
  emailBookingNotificationsEnabled: boolean;
  smsBookingRemindersEnabled: boolean;
  emailBookingRemindersEnabled: boolean;
  smsThankYouReceiptEnabled: boolean;
  emailThankYouReceiptEnabled: boolean;
  smsPaymentConfirmedEnabled: boolean;
  emailPaymentConfirmedEnabled: boolean;
  theme: SiteSettingsPublic['theme'];
};

function toFormValues(s: SiteSettingsPublic): FormValues {
  return {
    businessName: s.businessName,
    addressLine1: s.addressLine1,
    city: s.city,
    region: s.region,
    postalCode: s.postalCode,
    country: s.country,
    phone: s.phone,
    publicEmail: s.publicEmail,
    latitude: s.latitude != null ? String(s.latitude) : '',
    longitude: s.longitude != null ? String(s.longitude) : '',
    openingHoursText: s.openingHours.join('\n'),
    bookingTimeZone: s.bookingTimeZone,
    bookingHoursJson: JSON.stringify(s.bookingHours, null, 2),
    bookingSessionMinutes: String(s.bookingSessionMinutes),
    bookingBreakMinutes: String(s.bookingBreakMinutes),
    bookingConcurrentSeatsPerSlot: String(s.bookingConcurrentSeatsPerSlot),
    defaultLocale: s.defaultLocale,
    smsBookingNotificationsEnabled: s.smsBookingNotificationsEnabled,
    emailBookingNotificationsEnabled: s.emailBookingNotificationsEnabled,
    smsBookingRemindersEnabled: s.smsBookingRemindersEnabled,
    emailBookingRemindersEnabled: s.emailBookingRemindersEnabled,
    smsThankYouReceiptEnabled: s.smsThankYouReceiptEnabled,
    emailThankYouReceiptEnabled: s.emailThankYouReceiptEnabled,
    smsPaymentConfirmedEnabled: s.smsPaymentConfirmedEnabled,
    emailPaymentConfirmedEnabled: s.emailPaymentConfirmedEnabled,
    theme: { ...s.theme },
  };
}

export function AdminSettingsView({ initial }: { initial: SiteSettingsPublic }): React.JSX.Element {
  const t = useTranslations('adminSettings');
  const fetchAuthed = useAuthedFetch();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: queryKeys.siteSettingsPublic,
    queryFn: async () => {
      const raw = await publicFetch<unknown>('/public/site-settings');
      return siteSettingsPublicSchema.parse(raw);
    },
    initialData: initial,
  });

  const form = useForm<FormValues>({
    values: settingsQuery.data ? toFormValues(settingsQuery.data) : toFormValues(initial),
  });

  const saveMutation = useMutation({
    mutationFn: async (body: PatchSiteSettingsInput) => {
      const raw = await fetchAuthed<unknown>('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return siteSettingsPublicSchema.parse(raw);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.siteSettingsPublic });
    },
  });

  function onSubmit(values: FormValues): void {
    const hours = values.openingHoursText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    let bookingHoursParsed;
    try {
      bookingHoursParsed = bookingHoursSpecSchema.parse(
        JSON.parse(values.bookingHoursJson) as unknown,
      );
    } catch {
      toast.error('Invalid booking hours JSON. Expected { "rules": [ { "daysOfWeek", "open", "close" } ] }.');
      return;
    }
    const lat = values.latitude.trim() === '' ? null : Number.parseFloat(values.latitude);
    const lng = values.longitude.trim() === '' ? null : Number.parseFloat(values.longitude);
    const sessionM = Number.parseInt(values.bookingSessionMinutes, 10);
    const breakM = Number.parseInt(values.bookingBreakMinutes, 10);
    const seats = Number.parseInt(values.bookingConcurrentSeatsPerSlot, 10);
    if (!Number.isFinite(sessionM) || sessionM < 1) {
      toast.error('Session length must be a positive number (minutes).');
      return;
    }
    if (!Number.isFinite(breakM) || breakM < 0) {
      toast.error('Break minutes must be zero or more.');
      return;
    }
    if (!Number.isFinite(seats) || seats < 1) {
      toast.error('Seats per slot must be at least 1.');
      return;
    }
    const body = patchSiteSettingsSchema.parse({
      businessName: values.businessName,
      addressLine1: values.addressLine1,
      city: values.city,
      region: values.region,
      postalCode: values.postalCode,
      country: values.country,
      phone: values.phone,
      publicEmail: values.publicEmail,
      latitude: lat != null && Number.isFinite(lat) ? lat : null,
      longitude: lng != null && Number.isFinite(lng) ? lng : null,
      openingHours: hours,
      bookingTimeZone: values.bookingTimeZone.trim(),
      bookingHours: bookingHoursParsed,
      bookingSessionMinutes: sessionM,
      bookingBreakMinutes: breakM,
      bookingConcurrentSeatsPerSlot: seats,
      defaultLocale: values.defaultLocale,
      theme: values.theme,
      smsBookingNotificationsEnabled: values.smsBookingNotificationsEnabled,
      emailBookingNotificationsEnabled: values.emailBookingNotificationsEnabled,
      smsBookingRemindersEnabled: values.smsBookingRemindersEnabled,
      emailBookingRemindersEnabled: values.emailBookingRemindersEnabled,
      smsThankYouReceiptEnabled: values.smsThankYouReceiptEnabled,
      emailThankYouReceiptEnabled: values.emailThankYouReceiptEnabled,
      smsPaymentConfirmedEnabled: values.smsPaymentConfirmedEnabled,
      emailPaymentConfirmedEnabled: values.emailPaymentConfirmedEnabled,
    });
    saveMutation.mutate(body);
  }

  return (
    <Card className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold uppercase tracking-tight text-foreground md:text-3xl">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground/75">{t('subtitle')}</p>
      </div>

      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('businessName')}>
            <input className={inputClass} {...form.register('businessName')} />
          </Field>
          <Field label={t('defaultLocale')}>
            <select className={inputClass} {...form.register('defaultLocale')}>
              <option value="en">en</option>
              <option value="es">es</option>
            </select>
          </Field>
          <Field label={t('address')}>
            <input className={inputClass} {...form.register('addressLine1')} />
          </Field>
          <Field label={t('city')}>
            <input className={inputClass} {...form.register('city')} />
          </Field>
          <Field label={t('region')}>
            <input className={inputClass} {...form.register('region')} />
          </Field>
          <Field label={t('postal')}>
            <input className={inputClass} {...form.register('postalCode')} />
          </Field>
          <Field label={t('country')}>
            <input className={inputClass} {...form.register('country')} />
          </Field>
          <Field label={t('phone')}>
            <input className={inputClass} {...form.register('phone')} />
          </Field>
          <Field label={t('email')}>
            <input className={inputClass} {...form.register('publicEmail')} />
          </Field>
          <Field label={t('latitude')}>
            <input className={cn(inputClass, 'font-mono text-xs')} {...form.register('latitude')} />
          </Field>
          <Field label={t('longitude')}>
            <input className={cn(inputClass, 'font-mono text-xs')} {...form.register('longitude')} />
          </Field>
        </div>

        <Field label={t('openingHours')}>
          <textarea rows={4} className={inputClass} {...form.register('openingHoursText')} />
        </Field>

        <Field label={t('bookingTimeZone')}>
          <select className={inputClass} {...form.register('bookingTimeZone')}>
            {(() => {
              const cur = form.watch('bookingTimeZone');
              const extra =
                cur && !BOOKING_TIME_ZONES.includes(cur as (typeof BOOKING_TIME_ZONES)[number]) ? (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ) : null;
              return (
                <>
                  {extra}
                  {BOOKING_TIME_ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </>
              );
            })()}
          </select>
          <p className="mt-1 text-xs text-foreground/60">
            Used for first/last bookable slot each day. Add other zones in code if needed.
          </p>
        </Field>

        <Field label={t('bookingHours')}>
          <textarea rows={10} className={cn(inputClass, 'font-mono text-xs')} {...form.register('bookingHoursJson')} />
          <p className="mt-1 text-xs text-foreground/60">
            daysOfWeek: 0=Sun … 6=Sat. Example: one rule for every day 07:00–20:00.
          </p>
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Booking session (minutes)">
            <input
              type="number"
              min={1}
              className={inputClass}
              {...form.register('bookingSessionMinutes')}
            />
            <p className="mt-1 text-xs text-foreground/60">Length of one slot block.</p>
          </Field>
          <Field label="Break between sessions (minutes)">
            <input
              type="number"
              min={0}
              className={inputClass}
              {...form.register('bookingBreakMinutes')}
            />
            <p className="mt-1 text-xs text-foreground/60">Cleaning / turnover buffer.</p>
          </Field>
          <Field label="Concurrent seats per service">
            <input
              type="number"
              min={1}
              className={inputClass}
              {...form.register('bookingConcurrentSeatsPerSlot')}
            />
            <p className="mt-1 text-xs text-foreground/60">Max bookings per time slot, per service.</p>
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
            {t('notifySectionBooking')}
          </p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('smsBookingNotificationsEnabled')} />
              {t('smsOnBooking')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('emailBookingNotificationsEnabled')} />
              {t('emailOnBooking')}
            </label>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
            {t('notifySectionReminders')}
          </p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('smsBookingRemindersEnabled')} />
              {t('smsReminders')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('emailBookingRemindersEnabled')} />
              {t('emailReminders')}
            </label>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
            {t('notifySectionThankYou')}
          </p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('smsThankYouReceiptEnabled')} />
              {t('smsThankYou')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('emailThankYouReceiptEnabled')} />
              {t('emailThankYou')}
            </label>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
            Payment confirmed (customer)
          </p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('smsPaymentConfirmedEnabled')} />
              SMS after card payment
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('emailPaymentConfirmedEnabled')} />
              Email after card payment
            </label>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground/70">{t('theme')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                'brandBrown',
                'brandCream',
                'brandOrange',
                'brandWhite',
                'background',
                'foreground',
                'primary',
                'muted',
                'card',
                'border',
              ] as const
            ).map((key) => (
              <Field key={key} label={key}>
                <input className={cn(inputClass, 'font-mono text-xs')} {...form.register(`theme.${key}`)} />
              </Field>
            ))}
          </div>
        </div>

        {saveMutation.isError ? (
          <p className="text-sm text-red-700">{safeClientErrorMessage(saveMutation.error, 'Save failed')}</p>
        ) : null}

        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t('saving') : t('save')}
        </Button>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{label}</p>
      {children}
    </div>
  );
}
