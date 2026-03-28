import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    addressId: z.string().optional(),
    shippingRecipientName: z.string().min(2).max(120).optional(),
    shippingPhone: z.string().min(8).max(20).optional(),
    shippingAddress: z.string().min(5).max(500).optional(),
    shippingFee: z.number().nonnegative().optional(),
    voucherCode: z.string().optional(),
    paymentMethod: z.enum(['cod', 'banking', 'momo', 'vnpay']).optional(),
    selectedVariantIds: z.array(z.string().min(1)).optional()
  })
});

export const listOrdersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    userId: z.string().optional(),
    search: z.string().optional(),
    status: z
      .enum([
        'pending',
        'confirmed',
        'shipping',
        'delivered',
        'completed',
        'cancelled',
        'returned'
      ])
      .optional()
  })
});

export const orderStatisticsSchema = z.object({
  query: z.object({
    days: z.string().regex(/^\d+$/).optional()
  })
});

export const orderIdParamSchema = z.object({
  params: z.object({
    orderId: z.string().min(1)
  })
});

export const cancelOrderSchema = z.object({
  params: z.object({
    orderId: z.string().min(1)
  }),
  body: z
    .object({
      note: z.string().max(255).optional()
    })
    .optional()
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    orderId: z.string().min(1)
  }),
  body: z.object({
    status: z.enum([
      'pending',
      'confirmed',
      'completed',
      'shipping',
      'delivered',
      'cancelled',
      'returned'
    ]),
    note: z.string().max(255).optional()
  })
});

export const repayVnpayOrderSchema = z.object({
  params: z.object({
    orderId: z.string().min(1)
  })
});

export const verifyVnpayReturnSchema = z.object({
  body: z
    .object({
      vnp_TxnRef: z.string().min(1),
      vnp_ResponseCode: z.string().min(1),
      vnp_SecureHash: z.string().min(1),
      vnp_TransactionStatus: z.string().optional(),
      vnp_TransactionNo: z.string().optional(),
      vnp_BankCode: z.string().optional(),
      vnp_Amount: z.union([z.string(), z.number()]).optional()
    })
    .passthrough()
});

export const createReturnRequestSchema = z.object({
  params: z.object({
    orderId: z.string().min(1)
  }),
  body: z.object({
    items: z
      .array(
        z.object({
          variantId: z.string().min(1),
          quantity: z.number().int().positive()
        })
      )
      .min(1),
    reason: z.string().max(500).optional(),
    refundMethod: z.enum(['bank_transfer', 'wallet']).optional()
  })
});

export const updateReturnRequestSchema = z.object({
  params: z.object({
    orderId: z.string().min(1),
    returnRequestId: z.string().min(1)
  }),
  body: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'refunded']),
    refundMethod: z.enum(['bank_transfer', 'wallet']).optional(),
    note: z.string().max(500).optional(),
    refundEvidenceImages: z.array(z.string().min(1)).optional()
  })
});
