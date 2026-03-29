import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    addressId: z.string().optional(),
    shippingRecipientName: z.string().min(2).max(120).optional(),
    shippingPhone: z.string().min(8).max(20).optional(),
    shippingAddress: z.string().min(5).max(500).optional(),
    shippingFee: z.number().nonnegative().optional(),
    voucherCode: z.string().optional(),
    paymentMethod: z.enum(['cod', 'banking', 'momo', 'vnpay', 'zalopay']).optional(),
    zalopayChannel: z.enum(['gateway', 'wallet', 'bank_card', 'atm']).optional(),
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
      .enum(['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled', 'returned'])
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
      'preparing',
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

export const verifyZalopayCallbackSchema = z.object({
  body: z
    .object({
      data: z.string().min(1),
      mac: z.string().min(1),
      type: z.union([z.string(), z.number()]).optional()
    })
    .passthrough()
});

export const verifyZalopayRedirectSchema = z.object({
  body: z
    .object({
      appid: z.string().min(1),
      apptransid: z.string().min(1),
      pmcid: z.string().optional(),
      bankcode: z.string().optional(),
      amount: z.union([z.string(), z.number()]).optional(),
      discountamount: z.union([z.string(), z.number()]).optional(),
      status: z.union([z.string(), z.number()]).optional(),
      checksum: z.string().min(1)
    })
    .passthrough()
});
