import { z } from 'zod';

export const listVouchersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    code: z.string().optional()
  })
});

export const listAvailableVouchersSchema = z.object({
  query: z.object({
    subtotal: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .optional()
  })
});

export const voucherIdParamSchema = z.object({
  params: z.object({
    voucherId: z.string().min(1)
  })
});

export const createVoucherSchema = z.object({
  body: z
    .object({
      code: z.string().trim().min(2).max(50),
      description: z.string().optional(),
      discountType: z.enum(['percentage', 'fixed_amount']),
      discountValue: z.number().positive(),
      minOrderValue: z.number().nonnegative().optional(),
      maxDiscountAmount: z.number().nonnegative().optional(),
      startDate: z.string().datetime(),
      expirationDate: z.string().datetime(),
      usageLimit: z.number().int().positive(),
      isActive: z.boolean().optional()
    })
    .superRefine((value, ctx) => {
      const startDate = new Date(value.startDate);
      const expirationDate = new Date(value.expirationDate);

      if (expirationDate <= startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expirationDate'],
          message: 'expirationDate must be greater than startDate'
        });
      }

      if (value.discountType === 'percentage' && value.discountValue > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discountValue'],
          message: 'discountValue for percentage must be <= 100'
        });
      }
    })
});

export const updateVoucherSchema = z.object({
  params: z.object({
    voucherId: z.string().min(1)
  }),
  body: z
    .object({
      description: z.string().optional(),
      discountType: z.enum(['percentage', 'fixed_amount']).optional(),
      discountValue: z.number().positive().optional(),
      minOrderValue: z.number().nonnegative().optional(),
      maxDiscountAmount: z.number().nonnegative().optional(),
      startDate: z.string().datetime().optional(),
      expirationDate: z.string().datetime().optional(),
      usageLimit: z.number().int().nonnegative().optional(),
      isActive: z.boolean().optional()
    })
    .superRefine((value, ctx) => {
      if (Object.keys(value).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one field is required'
        });
      }

      if (
        value.startDate &&
        value.expirationDate &&
        new Date(value.expirationDate) <= new Date(value.startDate)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expirationDate'],
          message: 'expirationDate must be greater than startDate'
        });
      }

      if (
        value.discountType === 'percentage' &&
        typeof value.discountValue === 'number' &&
        value.discountValue > 100
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discountValue'],
          message: 'discountValue for percentage must be <= 100'
        });
      }
    })
});