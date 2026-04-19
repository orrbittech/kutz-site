import { z } from 'zod';

export const themeTokensSchema = z.object({
  brandBrown: z.string(),
  brandCream: z.string(),
  brandOrange: z.string(),
  brandWhite: z.string(),
  background: z.string(),
  foreground: z.string(),
  primary: z.string(),
  muted: z.string(),
  card: z.string(),
  border: z.string(),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;

/** JS getDay(): 0 = Sunday … 6 = Saturday */
export const bookingHoursRuleSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});

export const bookingHoursSpecSchema = z.object({
  rules: z.array(bookingHoursRuleSchema).min(1),
});

export type BookingHoursSpec = z.infer<typeof bookingHoursSpecSchema>;

export const siteSettingsPublicSchema = z.object({
  businessName: z.string(),
  addressLine1: z.string(),
  city: z.string(),
  region: z.string(),
  postalCode: z.string(),
  country: z.string(),
  phone: z.string(),
  publicEmail: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  openingHours: z.array(z.string()),
  bookingTimeZone: z.string().min(1).max(64),
  bookingHours: bookingHoursSpecSchema,
  defaultLocale: z.string(),
  theme: themeTokensSchema,
  smsBookingNotificationsEnabled: z.boolean(),
  emailBookingNotificationsEnabled: z.boolean(),
  smsBookingRemindersEnabled: z.boolean(),
  emailBookingRemindersEnabled: z.boolean(),
  smsThankYouReceiptEnabled: z.boolean(),
  emailThankYouReceiptEnabled: z.boolean(),
  smsPaymentConfirmedEnabled: z.boolean(),
  emailPaymentConfirmedEnabled: z.boolean(),
  bookingSessionMinutes: z.number().int().min(1).max(24 * 60),
  bookingBreakMinutes: z.number().int().min(0).max(24 * 60),
  bookingSlotStepMinutes: z.number().int().min(1).max(24 * 60),
  bookingConcurrentSeatsPerSlot: z.number().int().min(1).max(500),
});

export type SiteSettingsPublic = z.infer<typeof siteSettingsPublicSchema>;

const optionalTheme = themeTokensSchema.partial();

export const patchSiteSettingsSchema = z.object({
  businessName: z.string().min(1).max(256).optional(),
  addressLine1: z.string().max(512).optional(),
  city: z.string().max(128).optional(),
  region: z.string().max(64).optional(),
  postalCode: z.string().max(32).optional(),
  country: z.string().max(64).optional(),
  phone: z.string().max(64).optional(),
  publicEmail: z.string().max(256).optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  openingHours: z.array(z.string()).optional(),
  bookingTimeZone: z.string().min(1).max(64).optional(),
  bookingHours: bookingHoursSpecSchema.optional(),
  defaultLocale: z.string().max(16).optional(),
  theme: optionalTheme.optional(),
  smsBookingNotificationsEnabled: z.boolean().optional(),
  emailBookingNotificationsEnabled: z.boolean().optional(),
  smsBookingRemindersEnabled: z.boolean().optional(),
  emailBookingRemindersEnabled: z.boolean().optional(),
  smsThankYouReceiptEnabled: z.boolean().optional(),
  emailThankYouReceiptEnabled: z.boolean().optional(),
  bookingSessionMinutes: z.number().int().min(1).max(24 * 60).optional(),
  bookingBreakMinutes: z.number().int().min(0).max(24 * 60).optional(),
  bookingConcurrentSeatsPerSlot: z.number().int().min(1).max(500).optional(),
});

export type PatchSiteSettingsInput = z.infer<typeof patchSiteSettingsSchema>;

export const defaultSiteSettingsPublic: SiteSettingsPublic = {
  businessName: 'Kutz',
  addressLine1: '352 Van Heerden, Halfway Gardens',
  city: 'Midrand',
  region: 'Gauteng',
  postalCode: '1685',
  country: 'ZA',
  phone: '+27 00 000 0000',
  publicEmail: 'hello@example.com',
  latitude: -25.995,
  longitude: 28.13,
  openingHours: ['Mo-Su 07:00-20:00'],
  bookingTimeZone: 'Africa/Johannesburg',
  bookingHours: {
    rules: [
      { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], open: '07:00', close: '20:00' },
    ],
  },
  defaultLocale: 'en',
  theme: {
    brandBrown: '#000000',
    brandCream: '#F5F5F5',
    brandOrange: '#1A1A1A',
    brandWhite: '#FFFFFF',
    background: '#FFFFFF',
    foreground: '#000000',
    primary: '#000000',
    muted: '#737373',
    card: '#FFFFFF',
    border: '#E5E5E5',
  },
  smsBookingNotificationsEnabled: true,
  emailBookingNotificationsEnabled: true,
  smsBookingRemindersEnabled: true,
  emailBookingRemindersEnabled: true,
  smsThankYouReceiptEnabled: true,
  emailThankYouReceiptEnabled: true,
  smsPaymentConfirmedEnabled: true,
  emailPaymentConfirmedEnabled: true,
  bookingSessionMinutes: 15,
  bookingBreakMinutes: 10,
  bookingSlotStepMinutes: 25,
  bookingConcurrentSeatsPerSlot: 5,
};
