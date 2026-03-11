import {
  cancelMyOrderController,
  createOrderController,
  getOrderStatisticsController,
  getMyOrderByIdController,
  listAllOrdersController,
  listMyOrdersController,
  retryMyVnpayPaymentController,
  updateOrderStatusController,
  verifyVnpayReturnController
} from '@controllers/order.controller';
import { requireBearerAuth } from '@middlewares/auth.middleware';
import { parsePaginationMiddleware } from '@middlewares/pagination.middleware';
import { requireRoles } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  cancelOrderSchema,
  createOrderSchema,
  listOrdersSchema,
  orderStatisticsSchema,
  orderIdParamSchema,
  repayVnpayOrderSchema,
  updateOrderStatusSchema,
  verifyVnpayReturnSchema
} from '@validators/order.validator';
import { Router } from 'express';

const orderRouter = Router();

orderRouter.post(
  '/vnpay/verify-return',
  validate(verifyVnpayReturnSchema),
  verifyVnpayReturnController
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
