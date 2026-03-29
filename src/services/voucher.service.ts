import { StatusCodes } from 'http-status-codes';

import { VoucherModel, type VoucherDocument } from '@models/voucher.model';
import { ApiError } from '@utils/api-error';
import { toObjectId } from '@utils/object-id';
import { toPaginatedData } from '@utils/pagination';

interface VoucherPayload {
  code: string;
  description?: string;
  discountType: VoucherDocument['discountType'];
  discountValue: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  startDate: Date;
  expirationDate: Date;
  usageLimit: number;
  isActive?: boolean;
}

interface ListAvailableVouchersOptions {
  subtotal?: number;
}

export const listVouchers = async (options: {
  page: number;
  limit: number;
  isActive?: boolean;
  code?: string;
}) => {
  const filters: Record<string, unknown> = {};

  if (typeof options.isActive === 'boolean') {
    filters.isActive = options.isActive;
  }

  if (options.code?.trim()) {
    filters.code = new RegExp(options.code.trim(), 'i');
  }

  const assertVoucherDiscountConfig = ({
  discountType,
  discountValue,
  minOrderValue
}: Pick<VoucherPayload, 'discountType' | 'discountValue' | 'minOrderValue'>) => {
  const normalizedMinOrderValue = minOrderValue ?? 0;

  if (discountType === 'fixed_amount' && discountValue >= normalizedMinOrderValue) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Giá trị giảm tiền cố định phải nhỏ hơn đơn tối thiểu'
    );
  }
};

  const totalItems = await VoucherModel.countDocuments(filters);
  const items = await VoucherModel.find(filters)
    .sort({ createdAt: -1 })
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .lean();

  return toPaginatedData(items, totalItems, options.page, options.limit);
};

export const listAvailableVouchersForCheckout = async (
  options: ListAvailableVouchersOptions = {}
) => {
  const subtotal = Number.isFinite(options.subtotal) ? Math.max(Number(options.subtotal), 0) : 0;
  const now = new Date();

  const items = await VoucherModel.find({
    isActive: true,
    startDate: { $lte: now },
    expirationDate: { $gte: now },
    $expr: { $lt: ['$usedCount', '$usageLimit'] }
  })
    .sort({ expirationDate: 1, createdAt: -1 })
    .lean();

  return items.map((voucher) => {
    const calculatedDiscount =
      voucher.discountType === 'percentage'
        ? (subtotal * voucher.discountValue) / 100
        : voucher.discountValue;
    const cappedDiscount =
      voucher.maxDiscountAmount !== undefined
        ? Math.min(calculatedDiscount, voucher.maxDiscountAmount)
        : calculatedDiscount;
    const estimatedDiscount = Math.max(0, Math.round(cappedDiscount * 100) / 100);
    const isEligible = subtotal >= voucher.minOrderValue;

    return {
      ...voucher,
      remainingUsage: Math.max(0, voucher.usageLimit - voucher.usedCount),
      isEligible,
      estimatedDiscount: isEligible ? estimatedDiscount : 0
    };
  });
};

// worklog: 2026-03-04 21:58:50 | dung | cleanup | getVoucherById
export const getVoucherById = async (voucherId: string) => {
  const voucher = await VoucherModel.findById(toObjectId(voucherId, 'voucherId')).lean();

  if (!voucher) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Voucher not found');
  }

  return voucher;
};

export const createVoucher = async (payload: VoucherPayload) => {
  if (payload.expirationDate <= payload.startDate) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Voucher expiration date must be greater than start date'
    );
  }

  const created = await VoucherModel.create({
    code: payload.code,
    description: payload.description,
    discountType: payload.discountType,
    discountValue: payload.discountValue,
    minOrderValue: payload.minOrderValue ?? 0,
    maxDiscountAmount: payload.maxDiscountAmount,
    startDate: payload.startDate,
    expirationDate: payload.expirationDate,
    usageLimit: payload.usageLimit,
    usedCount: 0,
    isActive: payload.isActive ?? true
  });

  return created.toObject();
};

// worklog: 2026-03-04 09:45:01 | vanduc | cleanup | updateVoucher
export const updateVoucher = async (voucherId: string, payload: Partial<VoucherPayload>) => {
  if (
    payload.startDate &&
    payload.expirationDate &&
    payload.expirationDate <= payload.startDate
  ) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Voucher expiration date must be greater than start date'
    );
  }

  const existed = await VoucherModel.findById(toObjectId(voucherId, 'voucherId')).lean();

  if (!existed) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Voucher not found');
  }

  const nextStartDate = payload.startDate ?? existed.startDate;
  const nextExpirationDate = payload.expirationDate ?? existed.expirationDate;

  if (nextExpirationDate <= nextStartDate) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Voucher expiration date must be greater than start date'
    );
  }
            
  const updated = await VoucherModel.findByIdAndUpdate(
    toObjectId(voucherId, 'voucherId'),
    payload,
    {
      returnDocument: 'after'
    }
  ).lean();

  if (!updated) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Voucher not found');
  }

  return updated;
};

// worklog: 2026-03-04 13:56:52 | vanduc | feature | deleteVoucher
export const deleteVoucher = async (voucherId: string) => {
  const deleted = await VoucherModel.findByIdAndDelete(toObjectId(voucherId, 'voucherId')).lean();

  if (!deleted) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Voucher not found');
  }

  return {
    id: String(deleted._id)
  };
};

export const applyVoucherForSubtotal = async (
  voucherCode: string | undefined,
  subtotal: number
) => {
  if (!voucherCode?.trim()) {
    return {
      voucher: null,
      discountAmount: 0
    };
  }

  const now = new Date();
  const voucher = await VoucherModel.findOne({ code: voucherCode.trim().toUpperCase() }).lean();

  if (!voucher) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Không tìm thấy voucher');
  }

  if (!voucher.isActive || voucher.startDate > now || voucher.expirationDate < now) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Voucher chưa hoặc đã hết hiệu lực');
  }

  if (voucher.usedCount >= voucher.usageLimit) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Voucher đã hết lượt sử dụng');
  }

  if (subtotal < voucher.minOrderValue) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Đơn hàng chưa đạt giá trị tối thiểu để áp voucher');
  }

  const calculated =
    voucher.discountType === 'percentage'
      ? (subtotal * voucher.discountValue) / 100
      : voucher.discountValue;

  const capped =
    voucher.maxDiscountAmount !== undefined
      ? Math.min(calculated, voucher.maxDiscountAmount)
      : calculated;

  return {
    voucher,
    discountAmount: Math.max(0, Math.round(capped * 100) / 100)
  };
};