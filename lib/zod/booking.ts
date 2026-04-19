import { z } from 'zod';
import { BookingPaymentStatus, BookingStatus } from '../constants/enums';
import { styleCategorySchema } from './style';

const bookingStatusZ = z.enum([
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CANCELLED,
  BookingStatus.SERVICED,
]);

const bookingPaymentStatusZ = z.enum([
  BookingPaymentStatus.UNPAID,
  BookingPaymentStatus.PARTIAL,
  BookingPaymentStatus.PAID,
  BookingPaymentStatus.NOT_REQUIRED,
]);

export const styleLineItemSchema = z.object({
  styleId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

export const createBookingSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
  notes: z.string().max(2000).optional(),
  styleLineItems: z.array(styleLineItemSchema).min(1).max(32),
});

export const updateBookingSchema = z
  .object({
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    notes: z.string().max(2000).optional(),
    styleLineItems: z.array(styleLineItemSchema).min(1).max(32).optional(),
  })
  .refine(
    (data) =>
      data.scheduledAt !== undefined ||
      data.notes !== undefined ||
      data.styleLineItems !== undefined,
    {
      message: 'Provide scheduledAt, notes, and/or styleLineItems',
    },
  );

export const bookingStyleSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  priceCents: z.number().int().nullable(),
  durationMinutes: z.number().int().nullable().optional(),
  category: styleCategorySchema,
  quantity: z.number().int().min(1).max(99).default(1),
});

export const bookingResponseSchema = z.object({
  id: z.string().uuid(),
  bookingCode: z.string().min(1),
  clerkUserId: z.string(),
  scheduledAt: z.string(),
  status: bookingStatusZ,
  notes: z.string(),
  styleId: z.string().uuid().nullable(),
  styleName: z.string().nullable(),
  style: bookingStyleSummarySchema.nullable().optional(),
  styles: z.array(bookingStyleSummarySchema),
  stripePaymentIntentId: z.string().nullable(),
  paymentAmountCents: z.number().int().nullable(),
  paymentStatus: bookingPaymentStatusZ,
  totalDueCents: z.number().int().nullable(),
  amountPaidCents: z.number().int().nullable(),
  outstandingCents: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const bookingListSchema = z.array(bookingResponseSchema);

type BookingResponseZ = z.infer<typeof bookingResponseSchema>;

/** Zod + TS can infer several fields as `unknown`; narrow for app use. */
export type BookingResponse = Omit<
  BookingResponseZ,
  'id' | 'clerkUserId' | 'scheduledAt' | 'createdAt' | 'updatedAt' | 'styles'
> & {
  id: string;
  clerkUserId: string;
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
  styles: z.infer<typeof bookingStyleSummarySchema>[];
};

export function parseBookingResponse(data: unknown): BookingResponse {
  return bookingResponseSchema.parse(data) as BookingResponse;
}

export const bookingPaymentIntentResponseSchema = z.object({
  clientSecret: z.string(),
  amountCents: z.number().int(),
  currency: z.literal('zar'),
});

export type BookingPaymentIntentResponse = z.infer<
  typeof bookingPaymentIntentResponseSchema
>;

export const bookingOccupancySlotSchema = z.object({
  slotStart: z.string(),
  byStyleId: z.record(z.string().uuid(), z.number().int().min(0)),
});

export const bookingOccupancyResponseSchema = z.object({
  slots: z.array(bookingOccupancySlotSchema),
});

export type BookingOccupancyResponse = z.infer<typeof bookingOccupancyResponseSchema>;
