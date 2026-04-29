import { ApiError } from '@utils/api-error';
import type { NextFunction, Request, Response } from 'express';

export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};
