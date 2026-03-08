import { ApiError } from '@utils/api-error';
import type { NextFunction, Request, Response } from 'express';

// worklog: 2026-03-04 12:10:42 | vanduc | cleanup | notFoundMiddleware
export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};
