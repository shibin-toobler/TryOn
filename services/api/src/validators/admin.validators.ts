import { z } from 'zod';

export const createMerchantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  allowedOrigins: z.array(z.string().trim().min(1)).optional().default([]),
  theme: z
    .object({
      accent: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'accent must be a hex colour').optional(),
      headline: z.string().trim().max(120).optional(),
    })
    .optional(),
});

export const productSchema = z.object({
  externalId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  imageUrl: z.string().trim().url(),
  color: z.string().trim().max(60).optional().default(''),
  price: z.number().nonnegative().optional().default(0),
  currency: z.string().trim().length(3).optional().default('INR'),
  description: z.string().trim().max(1000).optional().default(''),
  category: z
    .enum(['dress', 'top', 'bottom', 'outerwear', 'full_outfit'])
    .optional()
    .default('dress'),
  promptHint: z.string().trim().max(500).optional().default(''),
  active: z.boolean().optional().default(true),
});

export const productBatchSchema = z.object({
  products: z.array(productSchema).min(1).max(500),
});

export const externalIdParamsSchema = z.object({
  externalId: z.string().trim().min(1).max(128),
});

export type CreateMerchantInput = z.infer<typeof createMerchantSchema>;
export type ProductInput = z.infer<typeof productSchema>;
