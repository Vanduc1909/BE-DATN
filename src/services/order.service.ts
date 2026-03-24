import { AddressModel } from '@/models/address.model';
import { CartModel } from '@/models/cart.model';
import { CommentModel } from '@/models/comment.model';
import { OrderDocument, OrderModel } from '@/models/order.model';
import { ProductModel } from '@/models/product.model';
import { ReviewModel } from '@/models/review.model';
import { UserModel } from '@/models/user.model';
import { VoucherModel } from '@/models/voucher.model';
import { OrderStatus, PaymentMethod } from '@/types/domain';
import { ApiError } from '@/utils/api-error';
import { addMoney, roundMoney, subtractMoney } from '@/utils/money';
import { toObjectId } from '@/utils/object-id';
import { assertOrderTransitionAllowed } from '@/utils/order-transition';
import { toPaginatedData } from '@/utils/pagination';
import { verifyVnpayReturnSchema } from '@/validators/order.validator';
import { StatusCodes } from 'http-status-codes';
import { createVnpayPaymentUrl } from './vnpay.service';
import { ProductVariantModel } from '@/models/product-variant.model';

interface CreaterOrderInput {
  addressId?: string;
  shippingRecipientName?: string;
  shippingPhone?: string;
  shippingAddress?: string;
  shippingFee?: number;
  voucherCode?: string;
  paymentMethod?: PaymentMethod;
  selectedVariantIds?: string[];
  clientIp?: string;
}

interface UpdateOrderStatusInput {
  orderId: string;
  status: OrderStatus;
  changedBy: string;
  note?: string;
}

interface RetryVnpayPaymentInput {
  userId: string;
  orderId: string;
  clientIp?: string;
}

interface ListOrderStatisticsOptions {
  days: number;
}

interface DailyRevenueItem {
  date: string;
  revenue: number;
  orders: number;
  deliveredOrders: number;
}

const ORDER_STATUS_ORDER: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'shipping',
  'delivered',
  'cancelled',
  'returned'
];

const PAYMENT_METHOD_ORDER: PaymentMethod[] = ['cod', 'banking', 'momo', 'vnpay'];

const toDateKey = (value: Date) => {
  return value.toISOString().slice(0, 10);
};

const buildDateRange = (days: number) => {
  const today = new Date();
  const toDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const fromDate = new Date(toDate);
  fromDate.setDate(fromDate.getDate() - (days - 1));
  fromDate.setHours(0, 0, 0, 0);

  return { fromDate, toDate };
};

const generateOrderCode = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomInt(100000, 999999);
  return `ORD-${datePart}-${randomPart}`;
};

const buildVnpayTxnRef = (orderCode: string) => {
  const compactOrderCode = orderCode
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(-12);
  const timePart = Date.now().toString().slice(-8);
  const randomPart = crypto.randomInt(1000, 9999);

  return `${compactOrderCode}${timePart}${randomPart}`;
};

const generateUniqueVnpayTxnRef = async (orderCode: string) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = buildVnpayTxnRef(orderCode);
    const existed = await OrderModel.exists({ paymentTxnRef: candidate });

    if (!existed) {
      return candidate;
    }
  }

  throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Không thể tạo mã giao dịch VNPay');
};

const resolveShippingInfo = async (userId: string, input: CreaterOrderInput) => {
  if (input.addressId) {
    const address = await AddressModel.findOne({
      _id: toObjectId(input.addressId, 'addressId'),
      userId: toObjectId(userId, 'userId')
    }).lean();

    if (!address) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Address not found');
    }

    return {
      shippingRecipientName: address.recipientName,
      shippingPhone: address.phone,
      shippingAddress: `${address.street}, ${address.ward}, ${address.district}, ${address.city}`
    };
  }

  if (!input.shippingRecipientName || !input.shippingPhone || !input.shippingAddress) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'shippingRecipientName, shippingPhone, shippingAddress are required when addressId is missing'
    );
  }

  return {
    shippingRecipientName: input.shippingRecipientName,
    shippingPhone: input.shippingPhone,
    shippingAddress: input.shippingAddress
  };
};

export const createOrderFormCart = async (userId: string, input: CreaterOrderInput) => {
  const userObjectId = toObjectId(userId, 'userId');
  const cart = await CartModel.findOne({ userId: userObjectId });

  if (!cart || cart.items.length === 0) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Cart is empty');
  }

  const selectedVariantIdSet = new Set(
    (input.selectedVariantIds ?? []).map((variantId) => String(toObjectId(variantId, 'variantId')))
  );

  const checkedOutCartItems =
    selectedVariantIdSet.size > 0
      ? cart.items.filter((item) => selectedVariantIdSet.has(String(item.variantId)))
      : cart.items;

  if (checkedOutCartItems.length === 0) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'No selected cart items to checkout');
  }

  const shippingInfo = await resolveShippingInfo(userId, input);
  const variantIds = checkedOutCartItems.map((item) => item.variantId);

  const variants = await ProductVariantModel.find({
    _id: {
      $in: variantIds
    }
  }).populate('colorId', 'name');

  const variantMap = new Map(variants.map((variant) => [String(variant._id), variant]));
  const productIds = variants.map((variant) => variant.productId);
  const products = await ProductModel.find({
    _id: {
      $in: productIds
    }
  }).lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const materializedItems = checkedOutCartItems.map((item) => {
    const variant = variantMap.get(String(item.variantId));

    if (!variant) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Variant in cart not found');
    }

    const product = productMap.get(String(variant.productId));

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Product in cart not found');
    }

    if (!variant.isAvailable || variant.stockQuantity < item.quantity) {
      const variantColor =
        typeof (variant.colorId as unknown as { name?: string })?.name === 'string'
          ? (variant.colorId as unknown as { name: string }).name
          : 'Unknown';

      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        `Variant ${variantColor} is out of stock`
      );
    }

    const total = roundMoney(variant.price * item.quantity);
    const variantColor =
      typeof (variant.colorId as unknown as { name?: string })?.name === 'string'
        ? (variant.colorId as unknown as { name: string }).name
        : 'Unknown';

    return {
      variant,
      product,
      snapshot: {
        productId: product._id,
        productName: product.name,
        variantId: variant._id,
        variantSku: variant.sku,
        variantColor,
        productImage: variant.images[0] ?? product.images?.[0],
        quantity: item.quantity,
        price: variant.price,
        total
      }
    };
  });

  const subtotal = roundMoney(
    materializedItems.reduce((sum, item) => addMoney(sum, item.snapshot.total), 0)
  );
  const { voucher, discountAmount } = await applyVoucherForSubtotal(
    input.voucherCode,
    subtotal,
    userId
  );
  const shippingFee = input.shippingFee ?? 0;
  const totalAmount = subtractMoney(addMoney(subtotal, shippingFee), discountAmount);
  const paymentMethod = input.paymentMethod ?? 'cod';

  for (const item of materializedItems) {
    item.variant.stockQuantity = Math.max(0, item.variant.stockQuantity - item.snapshot.quantity);

    if (item.variant.stockQuantity === 0) {
      item.variant.isAvailable = false;
    }

    await item.variant.save();
  }

  if (voucher) {
    await VoucherModel.updateOne(
      {
        _id: voucher._id
      },
      {
        $inc: {
          usedCount: 1
        }
      }
    );
  }

  const orderCode = generateOrderCode();
  const paymentTxnRef =
    paymentMethod === 'vnpay' ? await generateUniqueVnpayTxnRef(orderCode) : undefined;

  const created = await OrderModel.create({
    orderCode,
    userId: userObjectId,
    ...shippingInfo,
    subtotal,
    shippingFee,
    discountAmount,
    totalAmount,
    paymentMethod,
    paymentStatus: 'pending',
    paymentTxnRef,
    voucherId: voucher?._id,
    status: 'pending',
    items: materializedItems.map((item) => item.snapshot),
    statusHistory: [
      {
        status: 'pending',
        changedBy: userObjectId,
        note: 'Order created',
        changedAt: new Date()
      }
    ]
  });

  if (selectedVariantIdSet.size === 0) {
    cart.items = [];
  } else {
    cart.items = cart.items.filter((item) => !selectedVariantIdSet.has(String(item.variantId)));
  }

  await cart.save();

  let paymentUrl: string | undefined;

  if (paymentMethod === 'vnpay') {
    paymentUrl = createVnpayPaymentUrl({
      txnRef: paymentTxnRef ?? '',
      amount: totalAmount,
      orderInfo: `Thanh toan don hang ${orderCode}`,
      ipAddr: input.clientIp
    });
  }

  return {
    ...created.toObject(),
    paymentUrl
  };
};

const builtOrderSearchFilter = (search?: string) => {
  const normalizedSearch = search?.trim();

  if (!normalizedSearch) {
    return undefined;
  }

  const regex = new RegExp(normalizedSearch, 'i');

  return {
    $or: [{ orderCode: regex }, { shippingRecipientName: regex }, { shippingPhone: regex }]
  };
};

export const listMyOrders = async (
  userId: string,
  options: {
    page: number;
    limit: number;
    search?: string;
    status?: OrderStatus;
  }
) => {
  const filters: Record<string, unknown> = {
    userId: toObjectId(userId, 'userId')
  };

  if (options.status) {
    filters.status = options.status;
  }

  const searchFilter = builtOrderSearchFilter(options.search);

  if (searchFilter) {
    Object.assign(filters, searchFilter);
  }

  const totalItems = await OrderModel.countDocuments(filters);
  const items = await OrderModel.find(filters)
    .sort({ createdAt: -1 })
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .lean();

  return toPaginatedData(items, totalItems, options.page, options.limit);
};

export const listAllOrders = async (option: {
  page: number;
  limit: number;
  search?: string;
  status?: OrderStatus;
  userId?: string;
}) => {
  const filters: Record<string, unknown> = {};

  if (options.status) {
    filters.status = options.status;
  }

  if (options.userId) {
    filters.userId = toObjectId(options.userId, 'userId');
  }

  const searchFilter = builtOrderSearchFilter(options.search);

  if (searchFilter) {
    Object.assign(filters, searchFilter);
  }

  const totalItems = await OrderModel.countDocuments(filters);
  const items = await OrderModel.find(filters)
    .sort({ createdAt: -1 })
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .lean();

  return toPaginatedData(items, totalItems, options.page, options.limit);
};

export const getOrderStatistics = async (options: ListOrderStatisticsOptions) => {
  const normalizedDays = Math.min(Math.max(Math.trunc(options.days), 1), 90);
  const { fromDate, toDate } = buildDateRange(normalizedDays);

  const [
    orderSummaryAggregate,
    statusAggregate,
    paymentMethodAggregate,
    dailyAggregate,
    customersCount,
    staffCount,
    adminCount,
    activeUsers,
    inactiveUsers,
    totalProducts,
    availableProducts,
    outOfStockVariants,
    lowStockVariants,
    totalReviews,
    totalComments,
    totalItemsSoldAggregate,
    topProducts
  ] = await Promise.all([
    OrderModel.aggregate<{
      _id: null;
      totalOrders: number;
      deliveredOrders: number;
      processingOrders: number;
      cancelledOrders: number;
      grossRevenue: number;
      deliveredRevenue: number;
    }>([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
            }
          },
          processingOrders: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'confirmed', 'preparing', 'shipping']] }, 1, 0]
            }
          },
          cancelledOrders: {
            $sum: {
              $cond: [{ $in: ['$status', ['cancelled', 'returned']] }, 1, 0]
            }
          },
          grossRevenue: { $sum: '$totalAmount' },
          deliveredRevenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, '$totalAmount', 0]
            }
          }
        }
      }
    ]),
    OrderModel.aggregate<{
      _id: OrderStatus;
      count: number;
      revenue: number;
    }>([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, '$totalAmount', 0]
            }
          }
        }
      }
    ]),
    OrderModel.aggregate<{
      _id: PaymentMethod;
      count: number;
      revenue: number;
    }>([
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, '$totalAmount', 0]
            }
          }
        }
      }
    ]),
    OrderModel.aggregate<DailyRevenueItem & { _id: string }>([
      {
        $match: {
          createdAt: {
            $gte: fromDate,
            $lte: toDate
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          orders: { $sum: 1 },
          deliveredOrders: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
            }
          },
          revenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, '$totalAmount', 0]
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]),
    UserModel.countDocuments({ role: 'customer' }),
    UserModel.countDocuments({ role: 'staff' }),
    UserModel.countDocuments({ role: 'admin' }),
    UserModel.countDocuments({ isActive: { $ne: false } }),
    UserModel.countDocuments({ isActive: false }),
    ProductModel.countDocuments({}),
    ProductModel.countDocuments({ isAvailable: true }),
    ProductVariantModel.countDocuments({
      $or: [{ stockQuantity: { $lte: 0 } }, { isAvailable: false }]
    }),
    ProductVariantModel.countDocuments({
      stockQuantity: { $gt: 0, $lte: 5 },
      isAvailable: true
    }),
    ReviewModel.countDocuments({}),
    CommentModel.countDocuments({ targetModel: 'product', isHidden: { $ne: true } }),
    OrderModel.aggregate<{ _id: null; totalItemsSold: number }>([
      {
        $match: {
          status: 'delivered'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          totalItemsSold: {
            $sum: '$items.quantity'
          }
        }
      }
    ]),
    ProductModel.find({})
      .sort({ soldCount: -1, reviewCount: -1, createdAt: -1 })
      .limit(8)
      .select('name brand soldCount reviewCount averageRating isAvailable images')
      .lean()
  ]);

  const summaryData = orderSummaryAggregate[0] ?? {
    totalOrders: 0,
    deliveredOrders: 0,
    processingOrders: 0,
    cancelledOrders: 0,
    grossRevenue: 0,
    deliveredRevenue: 0
  };

  const totalItemsSold = totalItemsSoldAggregate[0]?.totalItemsSold ?? 0;
  const averageDeliveredOrderValue =
    summaryData.deliveredOrders > 0
      ? roundMoney(summaryData.deliveredRevenue / summaryData.deliveredOrders)
      : 0;

  const statusMap = new Map(
    statusAggregate.map((item) => [
      item._id,
      { count: item.count, revenue: roundMoney(item.revenue) }
    ])
  );
  const byStatus = ORDER_STATUS_ORDER.map((status) => {
    const value = statusMap.get(status);
    return {
      status,
      count: value?.count ?? 0,
      revenue: value?.revenue ?? 0
    };
  });

  const paymentMethodMap = new Map(
    paymentMethodAggregate.map((item) => [
      item._id,
      { count: item.count, revenue: roundMoney(item.revenue) }
    ])
  );
  const byPaymentMethod = PAYMENT_METHOD_ORDER.map((paymentMethod) => {
    const value = paymentMethodMap.get(paymentMethod);
    return {
      paymentMethod,
      count: value?.count ?? 0,
      revenue: value?.revenue ?? 0
    };
  });

  const dailyAggregateMap = new Map(
    dailyAggregate.map((item) => [
      item._id,
      {
        date: item._id,
        revenue: roundMoney(item.revenue),
        orders: item.orders,
        deliveredOrders: item.deliveredOrders
      }
    ])
  );

  const dailyRevenue: DailyRevenueItem[] = [];
  const cursorDate = new Date(fromDate);
  while (cursorDate <= toDate) {
    const key = toDateKey(cursorDate);
    const record = dailyAggregateMap.get(key);

    dailyRevenue.push({
      date: key,
      revenue: record?.revenue ?? 0,
      orders: record?.orders ?? 0,
      deliveredOrders: record?.deliveredOrders ?? 0
    });

    cursorDate.setDate(cursorDate.getDate() + 1);
  }

  return {
    summary: {
      totalOrders: summaryData.totalOrders,
      deliveredOrders: summaryData.deliveredOrders,
      processingOrders: summaryData.processingOrders,
      cancelledOrders: summaryData.cancelledOrders,
      grossRevenue: roundMoney(summaryData.grossRevenue),
      deliveredRevenue: roundMoney(summaryData.deliveredRevenue),
      averageDeliveredOrderValue,
      totalItemsSold,
      totalUsers: customersCount + staffCount + adminCount,
      customersCount,
      staffCount,
      adminCount,
      activeUsers,
      inactiveUsers,
      totalProducts,
      availableProducts,
      outOfStockVariants,
      lowStockVariants,
      totalReviews,
      totalComments
    },
    trends: {
      days: normalizedDays,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      dailyRevenue
    },
    breakdowns: {
      byStatus,
      byPaymentMethod
    },
    topProducts: topProducts.map((product) => ({
      productId: String(product._id),
      name: product.name,
      brand: product.brand,
      soldCount: product.soldCount,
      reviewCount: product.reviewCount,
      averageRating: product.averageRating,
      isAvailable: product.isAvailable,
      thumbnailUrl: product.images[0] ?? null
    }))
  };
};

export const getMyOrderById = async (userId: string, orderId: string) => {
  const order = await OrderModel.findOne({
    _id: toObjectId(orderId, 'orderId'),
    userId: toObjectId(userId, 'userId')
  }).lean();

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
  }

  return order;
};

const restoreStockForOrder = async (order: OrderDocument) => {
  for (const item of order.items) {
    const variant = await ProductVariantModel.findById(item.variantId);

    if (!variant) {
      continue;
    }

    variant.stockQuantity += item.quantity;

    if (variant.stockQuantity > 0) {
      variant.isAvailable = true;
    }

    await variant.save();
  }
};

const increaseSoldCount = async (order: OrderDocument, factor: 1 | -1) => {
  const increments = new Map<string, number>();

  for (const item of order.items) {
    const key = String(item.productId);
    increments.set(key, (increments.get(key) ?? 0) + item.quantity * factor);
  }

  for (const [productId, value] of increments.entries()) {
    await ProductModel.updateOne(
      {
        _id: toObjectId(productId, 'productId')
      },
      {
        $inc: {
          soldCount: value
        }
      }
    );
  }
};

export const updateOrderStatus = async ({
  orderId,
  status,
  changedBy,
  note
}: UpdateOrderStatusInput) => {
  const order = await OrderModel.findById(toObjectId(orderId, 'orderId'));

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
  }

  const previousStatus = order.status;
  assertOrderTransitionAllowed(previousStatus, status);

  if (status === 'cancelled' || status === 'returned') {
    await restoreStockForOrder(order);
  }

  if (status === 'delivered' && previousStatus !== 'delivered') {
    await increaseSoldCount(order, 1);
  }

  if (previousStatus === 'delivered' && status === 'returned') {
    await increaseSoldCount(order, -1);
  }

  if (status === 'cancelled' && order.paymentMethod === 'vnpay' && order.paymentStatus === 'paid') {
    order.paymentStatus = 'refunded';
    order.refundedAt = new Date();
  }

  order.status = status;
  order.statusHistory.push({
    status,
    changedBy: toObjectId(changedBy, 'changedBy'),
    note,
    changedAt: new Date()
  });

  await order.save();

  return order.toObject();
};

export const cancelMyOrder = async (userId: string, orderId: string, note?: string) => {
  const order = await OrderModel.findOne({
    _id: toObjectId(orderId, 'orderId'),
    userId: toObjectId(userId, 'userId')
  });

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
  }

  if (order.status !== 'pending') {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Chỉ có thể hủy đơn khi đang ở trạng thái chờ xác nhận'
    );
  }

  return updateOrderStatus({
    orderId,
    status: 'cancelled',
    changedBy: userId,
    note: note ?? 'Cancelled by customer'
  });
};

export const retryMyVnpayPayment = async ({
  userId,
  orderId,
  clientIp
}: RetryVnpayPaymentInput) => {
  const order = await OrderModel.findOne({
    _id: toObjectId(orderId, 'orderId'),
    userId: toObjectId(userId, 'userId')
  });

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
  }

  if (order.paymentMethod !== 'vnpay') {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Order is not paid by VNPay');
  }

  if (order.status !== 'pending') {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Chỉ có thể thanh toán lại khi đơn đang ở trạng thái chờ xác nhận'
    );
  }

  if (order.paymentStatus === 'paid') {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Order already paid');
  }

  const nextTxnRef = await generateUniqueVnpayTxnRef(order.orderCode);
  order.paymentTxnRef = nextTxnRef;
  order.paymentStatus = 'pending';
  order.paymentGatewayResponseCode = undefined;
  order.paymentTransactionNo = undefined;
  order.paidAt = undefined;
  await order.save();

  const paymentUrl = createVnpayPaymentUrl({
    txnRef: nextTxnRef,
    amount: order.totalAmount,
    orderInfo: `Thanh toan don hang ${order.orderCode}`,
    ipAddr: clientIp
  });

  return {
    ...order.toObject(),
    paymentUrl
  };
};

export const handleVnpayReturn = async (payload: Record<string, unknown>) => {
  const verifiedResult = verifyVnpayReturnSchema(payload);

  if (!verifiedResult.isVerified) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Invalid VNPay signature');
  }

  const order = await OrderModel.findOne({
    paymentTxnRef: verifiedResult.txnRef
  });

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found by VNPay transaction');
  }

  if (order.paymentMethod !== 'vnpay') {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Order payment method is not VNPay');
  }

  order.paymentGatewayResponseCode = verifiedResult.responseCode;

  if (verifiedResult.isSuccess) {
    order.paymentStatus = 'paid';
    order.paymentTransactionNo = verifiedResult.transactionNo;

    if (!order.paidAt) {
      order.paidAt = new Date();
    }
  } else if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded') {
    order.paymentStatus = 'failed';
  }

  await order.save();

  return {
    order: order.toObject(),
    isSuccess: verifiedResult.isSuccess,
    responseCode: verifiedResult.responseCode
  };
};
