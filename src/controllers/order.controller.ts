import {
  cancelMyOrder,
  getMyOrderById,
  getOrderStatistics,
  handleVnpayReturn,
  listAllOrders,
  listMyOrders,
  retryMyVnpayPayment,
  updateOrderStatus
} from '@/services/order.service';
import { OrderStatus } from '@/types/domain';
import { ApiError } from '@/utils/api-error';
import { asyncHandler } from '@/utils/async-handler';
import { getOptionalParam, getParam } from '@/utils/response';
import { StatusCodes } from 'http-status-codes';

const getUserId = (req: Request) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
  }

  return userId;
};

const getClientIpAddress = (req: Request) => {
  const xForwardedFor = req.headers['x-forwarded-for'];

  if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
    return xForwardedFor.split(',')[0].trim();
  }

  return req.ip;
};

export const createOrderController = asyncHandler(async (req, res) => {
  const data = await createOrderFromCart(getUserId(req), {
    ...req.body,
    clientIp: getClientIpAddress(req)
  });

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Create order successfully',
    data
  });
});

export const listMyOrdersController = asyncHandler(async (req, res) => {
  const data = await listMyOrders(getUserId(req), {
    page: res.locals.pagination?.page ?? 1,
    limit: res.locals.pagination?.limit ?? 20,
    search: getOptionalParam(req.query.search as string | string[] | undefined),
    status: getOptionalParam(req.query.status as string | string[] | undefined) as
      | OrderStatus
      | undefined
  });

  return sendSuccess(res, {
    message: 'Get orders successfully',
    data
  });
});

export const listAllOrdersController = asyncHandler(async (req, res) => {
  const data = await listAllOrders({
    page: res.locals.pagination?.page ?? 1,
    limit: res.locals.pagination?.limit ?? 20,
    search: getOptionalParam(req.query.search as string | string[] | undefined),
    status: getOptionalParam(req.query.status as string | string[] | undefined) as
      | OrderStatus
      | undefined,
    userId: getOptionalParam(req.query.userId as string | string[] | undefined)
  });

  return sendSuccess(res, {
    message: 'Get all orders successfully',
    data
  });
});

export const getMyOrderByIdController = asyncHandler(async (req, res) => {
  const data = await getMyOrderById(getUserId(req), getParam(req.params.orderId, 'orderId'));

  return sendSuccess(res, {
    message: 'Get order successfully',
    data
  });
});

export const cancelMyOrderController = asyncHandler(async (req, res) => {
  const data = await cancelMyOrder(
    getUserId(req),
    getParam(req.params.orderId, 'orderId'),
    req.body?.note
  );

  return sendSuccess(res, {
    message: 'Cancel order successfully',
    data
  });
});

export const retryMyVnpayPaymentController = asyncHandler(async (req, res) => {
  const data = await retryMyVnpayPayment({
    userId: getUserId(req),
    orderId: getParam(req.params.orderId, 'orderId'),
    clientIp: getClientIpAddress(req)
  });

  return sendSuccess(res, {
    message: 'Create VNPay payment URL successfully',
    data
  });
});

export const verifyVnpayReturnController = asyncHandler(async (req, res) => {
  const data = await handleVnpayReturn(req.body as Record<string, unknown>);

  return sendSuccess(res, {
    message: 'Verify VNPay return successfully',
    data
  });
});

export const updateOrderStatusController = asyncHandler(async (req, res) => {
  const data = await updateOrderStatus({
    orderId: getParam(req.params.orderId, 'orderId'),
    status: req.body.status,
    changedBy: getUserId(req),
    note: req.body.note
  });

  return sendSuccess(res, {
    message: 'Update order status successfully',
    data
  });
});

export const getOrderStatisticsController = asyncHandler(async (req, res) => {
  const daysRaw = Number(req.query.days);
  const normalizedDays = Number.isFinite(daysRaw)
    ? Math.min(Math.max(Math.trunc(daysRaw), 1), 90)
    : 7;
  const data = await getOrderStatistics({
    days: normalizedDays
  });

  return sendSuccess(res, {
    message: 'Get order statistics successfully',
    data
  });
});
