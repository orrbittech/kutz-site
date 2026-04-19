import { z } from 'zod';

export const styleCategorySchema = z.enum(['men', 'women', 'kids']);

export const styleResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  priceCents: z.number().int().nullable(),
  durationMinutes: z.number().int().nullable().optional(),
  category: styleCategorySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const styleListSchema = z.array(styleResponseSchema);

export type StyleResponse = z.infer<typeof styleResponseSchema>;
