import { z } from 'zod';
import { OrderStatus } from '../constants/enums';

const lineItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
});

const orderStatusZ = z.enum([
  OrderStatus.DRAFT,
  OrderStatus.PAID,
  OrderStatus.FULFILLED,
  OrderStatus.CANCELLED,
]);

export const createOrderSchema = z.object({
  lineItems: z.array(lineItemSchema).min(1).max(50),
  notes: z.string().max(2000).optional(),
});

export const orderResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  status: orderStatusZ,
  totalCents: z.number().int(),
  lineItems: z.array(lineItemSchema),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const orderListSchema = z.array(orderResponseSchema);

export type OrderResponse = z.infer<typeof orderResponseSchema>;
