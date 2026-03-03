import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { ApiError } from '@utils/api-error';

export const toObjectId = (value: string, fieldName = 'id') => {
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid ${fieldName}`);
  }

  return new Types.ObjectId(value);
};
