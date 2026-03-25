import {
  createVoucherController,
  deleteVoucherController,
  getVoucherByIdController,
  listAvailableVouchersController,
  listVouchersController,
  updateVoucherController
} from '@controllers/voucher.controller';
import { requireBearerAuth } from '@middlewares/auth.middleware';
import { parsePaginationMiddleware } from '@middlewares/pagination.middleware';
import { requireRoles } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createVoucherSchema,
  listAvailableVouchersSchema,
  listVouchersSchema,
  updateVoucherSchema,
  voucherIdParamSchema
} from '@validators/voucher.validator';
import { Router } from 'express';

const voucherRouter = Router();

voucherRouter.get(
  '/available',
  validate(listAvailableVouchersSchema),
  listAvailableVouchersController
);

voucherRouter.use(requireBearerAuth, requireRoles('admin'));
voucherRouter.get(
  '/',
  validate(listVouchersSchema),
  parsePaginationMiddleware,
  listVouchersController
);
voucherRouter.post('/', validate(createVoucherSchema), createVoucherController);
voucherRouter.get('/:voucherId', validate(voucherIdParamSchema), getVoucherByIdController);
voucherRouter.patch('/:voucherId', validate(updateVoucherSchema), updateVoucherController);
voucherRouter.delete('/:voucherId', validate(voucherIdParamSchema), deleteVoucherController);

export default voucherRouter;