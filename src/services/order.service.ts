import crypto from 'node:crypto';

import { StatusCodes } from 'http-status-codes';

import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/domain';
import { logger } from '@config/logger';
import { AddressModel } from '@models/address.model';
import { CartModel } from '@models/cart.model';
import { CommentModel } from '@models/comment.model';
import { OrderModel, type OrderDocument } from '@models/order.model';
import { ProductVariantModel } from '@models/product-variant.model';
import { ProductModel } from '@models/product.model';
import { ReviewModel } from '@models/review.model';
import { UserModel } from '@models/user.model';
import { sendMail } from '@services/mail.service';
import { emitStaffRealtimeNotification } from '@services/realtime-notification.service';
import { VoucherModel } from '@models/voucher.model';
import { createVnpayPaymentUrl, verifyVnpayReturnParams } from '@services/vnpay.service';
import { applyVoucherForSubtotal } from '@services/voucher.service';
import { ApiError } from '@utils/api-error';
import { addMoney, roundMoney, subtractMoney } from '@utils/money';
import { toObjectId } from '@utils/object-id';
import { assertOrderTransitionAllowed } from '@utils/order-transition';
import { toPaginatedData } from '@utils/pagination';

interface CreateOrderInput {
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

interface CategoryBreakdownAggregateItem {
  categoryId: unknown;
  categoryName: string;
  orders: number;
  deliveredOrders: number;
  items: number;
  revenue: number;
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
const MONEY_FORMATTER = new Intl.NumberFormat('vi-VN');

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  returned: 'Đã trả hàng'
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: 'COD',
  banking: 'Chuyển khoản',
  momo: 'MoMo',
  vnpay: 'VNPay'
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  refunded: 'Đã hoàn tiền'
};

type OrderMailSnapshot = Pick<
  OrderDocument,
  | 'orderCode'
  | 'status'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'shippingRecipientName'
  | 'shippingPhone'
  | 'shippingAddress'
  | 'subtotal'
  | 'shippingFee'
  | 'discountAmount'
  | 'totalAmount'
  | 'items'
  | 'createdAt'
  | 'updatedAt'
>;

interface SendOrderLifecycleMailInput {
  to: string;
  customerName?: string;
  order: OrderMailSnapshot;
  event: 'created' | 'status_updated';
  previousStatus?: OrderStatus;
  note?: string;
  paymentUrl?: string;
}

const escapeHtml = (value: string) => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const formatMoneyVnd = (value: number) => `${MONEY_FORMATTER.format(Math.max(0, roundMoney(value)))} ₫`;

const formatDateTime = (value?: Date | string) => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString('vi-VN', {
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh'
  });
};

const sendOrderLifecycleMail = async ({
  to,
  customerName,
  order,
  event,
  previousStatus,
  note,
  paymentUrl
}: SendOrderLifecycleMailInput) => {
  try {
    const itemsRowsHtml = order.items
      .map((item, index) => {
        return `
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${index + 1}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(item.productName)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(item.variantSku)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(item.variantColor)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${item.quantity}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatMoneyVnd(item.price)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatMoneyVnd(item.total)}</td>
          </tr>
        `;
      })
      .join('');

    const statusChangeHtml =
      event === 'status_updated'
        ? `
      <p style="margin:0 0 12px;color:#374151;">
        Trạng thái đơn hàng đã đổi từ
        <strong>${ORDER_STATUS_LABELS[previousStatus ?? order.status]}</strong>
        sang
        <strong>${ORDER_STATUS_LABELS[order.status]}</strong>.
      </p>
      ${note ? `<p style="margin:0 0 12px;color:#374151;">Ghi chú: ${escapeHtml(note)}</p>` : ''}
    `
        : `<p style="margin:0 0 12px;color:#374151;">Đơn hàng của bạn đã được tạo thành công.</p>`;

    const paymentLinkHtml =
      paymentUrl && event === 'created'
        ? `
      <p style="margin:0 0 12px;color:#374151;">
        Link thanh toán:
        <a href="${escapeHtml(paymentUrl)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(paymentUrl)}</a>
      </p>
    `
        : '';

    const subject =
      event === 'created'
        ? `[Golden Billiards] Xác nhận đơn hàng ${order.orderCode}`
        : `[Golden Billiards] Cập nhật trạng thái đơn hàng ${order.orderCode}`;

    const textItems = order.items
      .map((item, index) => {
        return `${index + 1}. ${item.productName} | SKU: ${item.variantSku} | Màu: ${item.variantColor} | SL: ${item.quantity} | Đơn giá: ${formatMoneyVnd(item.price)} | Thành tiền: ${formatMoneyVnd(item.total)}`;
      })
      .join('\n');

    const text =
      `Xin chào ${customerName ?? order.shippingRecipientName ?? 'bạn'},\n\n` +
      `${event === 'created' ? 'Đơn hàng của bạn đã được tạo thành công.' : 'Đơn hàng của bạn vừa được cập nhật trạng thái.'}\n` +
      `${event === 'status_updated' ? `Trạng thái: ${ORDER_STATUS_LABELS[previousStatus ?? order.status]} -> ${ORDER_STATUS_LABELS[order.status]}\n` : ''}` +
      `${note ? `Ghi chú: ${note}\n` : ''}` +
      `\nMã đơn: ${order.orderCode}\n` +
      `Người nhận: ${order.shippingRecipientName}\n` +
      `SĐT: ${order.shippingPhone}\n` +
      `Địa chỉ: ${order.shippingAddress}\n` +
      `Phương thức thanh toán: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}\n` +
      `Trạng thái thanh toán: ${PAYMENT_STATUS_LABELS[order.paymentStatus]}\n` +
      `Ngày tạo: ${formatDateTime(order.createdAt)}\n` +
      `Cập nhật gần nhất: ${formatDateTime(order.updatedAt)}\n` +
      `\nDanh sách sản phẩm:\n${textItems}\n` +
      `\nTạm tính: ${formatMoneyVnd(order.subtotal)}\n` +
      `Phí vận chuyển: ${formatMoneyVnd(order.shippingFee)}\n` +
      `Giảm giá: ${formatMoneyVnd(order.discountAmount)}\n` +
      `Tổng thanh toán: ${formatMoneyVnd(order.totalAmount)}\n` +
      `${paymentUrl && event === 'created' ? `\nLink thanh toán: ${paymentUrl}\n` : ''}` +
      `\nCảm ơn bạn đã mua sắm tại Golden Billiards.`;

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;background:#f3f4f6;">
    <tr>
      <td align="center">
        <table width="760" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:20px 24px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;">Golden Billiards</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px;color:#111827;">Xin chào <strong>${escapeHtml(
                customerName ?? order.shippingRecipientName ?? 'bạn'
              )}</strong>,</p>
              ${statusChangeHtml}
              ${paymentLinkHtml}
              <h3 style="margin:16px 0 8px;color:#111827;">Thông tin đơn hàng</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
                <tr><td style="padding:6px 0;color:#6b7280;width:180px;">Mã đơn</td><td style="padding:6px 0;color:#111827;">${escapeHtml(order.orderCode)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Người nhận</td><td style="padding:6px 0;color:#111827;">${escapeHtml(order.shippingRecipientName)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Số điện thoại</td><td style="padding:6px 0;color:#111827;">${escapeHtml(order.shippingPhone)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Địa chỉ</td><td style="padding:6px 0;color:#111827;">${escapeHtml(order.shippingAddress)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Trạng thái đơn</td><td style="padding:6px 0;color:#111827;">${ORDER_STATUS_LABELS[order.status]}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Phương thức thanh toán</td><td style="padding:6px 0;color:#111827;">${PAYMENT_METHOD_LABELS[order.paymentMethod]}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Trạng thái thanh toán</td><td style="padding:6px 0;color:#111827;">${PAYMENT_STATUS_LABELS[order.paymentStatus]}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Ngày tạo</td><td style="padding:6px 0;color:#111827;">${formatDateTime(order.createdAt)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Cập nhật gần nhất</td><td style="padding:6px 0;color:#111827;">${formatDateTime(order.updatedAt)}</td></tr>
              </table>

              <h3 style="margin:16px 0 8px;color:#111827;">Danh sách sản phẩm đã đặt</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:8px;border:1px solid #e5e7eb;">#</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;">Sản phẩm</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;">SKU</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;">Màu</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;">SL</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;">Đơn giá</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>${itemsRowsHtml}</tbody>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;">Tạm tính</td><td style="padding:6px 0;text-align:right;color:#111827;">${formatMoneyVnd(order.subtotal)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Phí vận chuyển</td><td style="padding:6px 0;text-align:right;color:#111827;">${formatMoneyVnd(order.shippingFee)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Giảm giá</td><td style="padding:6px 0;text-align:right;color:#111827;">-${formatMoneyVnd(order.discountAmount)}</td></tr>
                <tr><td style="padding:10px 0 0;font-size:16px;font-weight:700;color:#111827;">Tổng thanh toán</td><td style="padding:10px 0 0;text-align:right;font-size:16px;font-weight:700;color:#111827;">${formatMoneyVnd(order.totalAmount)}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const sent = await sendMail({
      to,
      subject,
      html,
      text
    });

    if (!sent) {
      logger.warn(`Không thể gửi email đơn hàng ${order.orderCode} tới ${to}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`Lỗi gửi email đơn hàng: ${(error as Error).message}`);
    return false;
  }
};

// worklog: 2026-03-04 09:35:15 | dung | refactor | toDateKey
const toDateKey = (value: Date) => {
  return value.toISOString().slice(0, 10);
};

// worklog: 2026-03-04 21:22:04 | vanduc | fix | buildDateRange
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

// worklog: 2026-03-04 09:25:21 | vanduc | refactor | buildVnpayTxnRef
const buildVnpayTxnRef = (orderCode: string) => {
  const compactOrderCode = orderCode.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-12);
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

// worklog: 2026-03-04 19:46:44 | dung | fix | resolveShippingInfo
const resolveShippingInfo = async (userId: string, input: CreateOrderInput) => {
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

export const createOrderFromCart = async (userId: string, input: CreateOrderInput) => {
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

  const customer = await UserModel.findById(userObjectId).select('email fullName').lean();

  if (customer?.email) {
    await sendOrderLifecycleMail({
      to: customer.email,
      customerName: customer.fullName,
      order: created.toObject() as OrderMailSnapshot,
      event: 'created',
      paymentUrl
    });
  }

  emitStaffRealtimeNotification({
    id: String(created._id),
    type: 'order_created',
    title: 'Đơn hàng mới',
    body: `${customer?.fullName ?? created.shippingRecipientName} vừa tạo đơn ${created.orderCode} (${created.items.length} sản phẩm)`,
    createdAt: new Date().toISOString(),
    url: '/dashboard/orders',
    metadata: {
      orderId: String(created._id),
      orderCode: created.orderCode,
      userId: String(created.userId),
      itemCount: created.items.length,
      totalAmount: created.totalAmount
    }
  });

  return {
    ...created.toObject(),
    paymentUrl
  };
};

const buildOrderSearchFilter = (search?: string) => {
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

  const searchFilter = buildOrderSearchFilter(options.search);

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

export const listAllOrders = async (options: {
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

  const searchFilter = buildOrderSearchFilter(options.search);

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
    categoryAggregate,
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
    topProducts,
    bottomProducts
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
    OrderModel.aggregate<CategoryBreakdownAggregateItem>([
      {
        $match: {
          createdAt: {
            $gte: fromDate,
            $lte: toDate
          }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: {
          path: '$product',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            categoryId: '$category._id',
            categoryName: {
              $ifNull: ['$category.name', 'Không xác định']
            }
          },
          orderIds: { $addToSet: '$_id' },
          deliveredOrderIds: {
            $addToSet: {
              $cond: [{ $eq: ['$status', 'delivered'] }, '$_id', null]
            }
          },
          items: { $sum: '$items.quantity' },
          revenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, '$items.total', 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          categoryId: '$_id.categoryId',
          categoryName: '$_id.categoryName',
          orders: { $size: '$orderIds' },
          deliveredOrders: {
            $size: {
              $setDifference: ['$deliveredOrderIds', [null]]
            }
          },
          items: 1,
          revenue: 1
        }
      },
      {
        $sort: {
          orders: -1,
          items: -1,
          categoryName: 1
        }
      },
      {
        $limit: 10
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
      .lean(),
    ProductModel.find({})
      .sort({ soldCount: 1, reviewCount: 1, createdAt: -1 })
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
    statusAggregate.map((item) => [item._id, { count: item.count, revenue: roundMoney(item.revenue) }])
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

  const byCategory = categoryAggregate.map((item) => ({
    categoryId: item.categoryId ? String(item.categoryId) : null,
    categoryName: item.categoryName,
    orders: item.orders,
    deliveredOrders: item.deliveredOrders,
    items: item.items,
    revenue: roundMoney(item.revenue)
  }));

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
      byPaymentMethod,
      byCategory
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
    })),
    bottomProducts: bottomProducts.map((product) => ({
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

// worklog: 2026-03-04 20:27:39 | dung | feature | getMyOrderById
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

// worklog: 2026-03-04 13:56:52 | vanduc | feature | restoreStockForOrder
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

// worklog: 2026-03-04 14:49:15 | vanduc | cleanup | increaseSoldCount
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

  const customer = await UserModel.findById(order.userId).select('email fullName').lean();

  if (customer?.email) {
    await sendOrderLifecycleMail({
      to: customer.email,
      customerName: customer.fullName,
      order: order.toObject() as OrderMailSnapshot,
      event: 'status_updated',
      previousStatus,
      note
    });
  }

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

export const retryMyVnpayPayment = async ({ userId, orderId, clientIp }: RetryVnpayPaymentInput) => {
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
  const verifiedResult = verifyVnpayReturnParams(payload);

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
