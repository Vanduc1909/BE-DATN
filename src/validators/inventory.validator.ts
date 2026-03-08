import { z } from 'zod';

export const listInventoryLogsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    productId: z.string().optional(),
    variantId: z.string().optional()
  })
});

export const adjustStockSchema = z.object({
  body: z.object({
    productId: z.string().min(1),
    variantId: z.string().min(1),
    changeAmount: z.number().int(),
    reason: z.enum(['import', 'sale', 'return', 'adjustment', 'damage']),
    note: z.string().max(500).optional()
  })
});
