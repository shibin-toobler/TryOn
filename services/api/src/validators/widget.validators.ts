import { z } from 'zod';

export const bootstrapQuerySchema = z.object({
  visitorToken: z.string().trim().min(1).max(64).optional(),
  productId: z.string().trim().min(1).max(128).optional(),
});

export const visitorTokenBodySchema = z.object({
  visitorToken: z.string().trim().min(1).max(64),
});

export const tryOnBodySchema = z.object({
  visitorToken: z.string().trim().min(1).max(64),
  productId: z.string().trim().min(1).max(128),
  force: z.coerce.boolean().optional().default(false),
});

export const recentQuerySchema = z.object({
  visitorToken: z.string().trim().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(24).optional().default(12),
});

export const generationParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type BootstrapQuery = z.infer<typeof bootstrapQuerySchema>;
export type TryOnBody = z.infer<typeof tryOnBodySchema>;
export type RecentQuery = z.infer<typeof recentQuerySchema>;
