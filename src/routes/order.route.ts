import {
  cancelMyOrderController,
  confirmOrderReceivedController,
  createOrderController,
  createReturnRequestController,
  getMyOrderByIdController,
  getOrderStatisticsController,
  handleZalopayCallbackController,
  listAllOrdersController,
  listMyOrdersController,
  updateReturnRequestController
  retryMyVnpayPaymentController,
  updateOrderStatusController,
  verifyVnpayReturnController,
  verifyZalopayRedirectController,
  createCancelRefundRequestController,
  updateCancelRefundRequestController
} from '@/controllers/order.controller';
import { requireBearerAuth } from '@/middlewares/auth.middleware';
import { parsePaginationMiddleware } from '@/middlewares/pagination.middleware';
import { requireRoles } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  cancelOrderSchema,
  createOrderSchema,
  listOrdersSchema,
  orderIdParamSchema,
  createReturnRequestSchema,
  updateReturnRequestSchema,
  orderStatisticsSchema,
  repayVnpayOrderSchema,
  updateOrderStatusSchema,
  verifyVnpayReturnSchema,
  verifyZalopayCallbackSchema,
  verifyZalopayRedirectSchema,
  createCancelRefundRequestSchema,
  updateCancelRefundRequestSchema
} from '@/validators/order.validator';
import { Router } from 'express';

const orderRouter = Router();

orderRouter.post(
  '/vnpay/verify-return',
  validate(verifyVnpayReturnSchema),
  verifyVnpayReturnController
);
orderRouter.post(
  '/zalopay/callback',
  validate(verifyZalopayCallbackSchema),
  handleZalopayCallbackController
);
orderRouter.post(
  '/zalopay/verify-redirect',
  validate(verifyZalopayRedirectSchema),
  verifyZalopayRedirectController
);
orderRouter.use(requireBearerAuth);
orderRouter.post('/', validate(createOrderSchema), createOrderController);
orderRouter.get('/', validate(listOrdersSchema), parsePaginationMiddleware, listMyOrdersController);

orderRouter.get(
  '/admin/all',
  requireRoles('staff', 'admin'),
  validate(listOrdersSchema),
  parsePaginationMiddleware,
  listAllOrdersController
);
orderRouter.get(
  '/admin/statistics',
  requireRoles('staff', 'admin'),
  validate(orderStatisticsSchema),
  getOrderStatisticsController
);
orderRouter.get('/:orderId', validate(orderIdParamSchema), getMyOrderByIdController);
orderRouter.post('/:orderId/cancel', validate(cancelOrderSchema), cancelMyOrderController);
orderRouter.post('/:orderId/repay', validate(repayVnpayOrderSchema), retryMyVnpayPaymentController);
orderRouter.patch(
  '/:orderId/status',
  requireRoles('staff', 'admin'),
  validate(updateOrderStatusSchema),
  updateOrderStatusController
);
orderRouter.post(
  '/:orderId/received',
  validate(orderIdParamSchema),
  confirmOrderReceivedController
);
orderRouter.post(
  '/:orderId/return',
  validate(createReturnRequestSchema),
  createReturnRequestController
);
orderRouter.post(
  '/:orderId/cancel-refund',
  validate(createCancelRefundRequestSchema),
  createCancelRefundRequestController
);
orderRouter.patch(
  '/:orderId/return/:returnRequestId',
  requireRoles('staff', 'admin'),
  validate(updateReturnRequestSchema),
  updateReturnRequestController
);
orderRouter.patch(
  '/:orderId/cancel-refund',
  requireRoles('staff', 'admin'),
  validate(updateCancelRefundRequestSchema),
  updateCancelRefundRequestController
);
orderRouter.post(
  '/:orderId/repay',
  validate(repayVnpayOrderSchema),
  retryMyVnpayPaymentController
);
orderRouter.patch(
  '/:orderId/status',
  requireRoles('staff', 'admin'),
  validate(updateOrderStatusSchema),
  updateOrderStatusController
);

export default orderRouter;
