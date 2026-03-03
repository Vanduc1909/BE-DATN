import type { NextFunction, Request, Response } from 'express';

import { env } from '@config/env';
import { parsePagination } from '@utils/pagination';

export const parsePaginationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.locals.pagination = parsePagination(req.query, {
    page: env.PAGINATION_DEFAULT_PAGE,
    limit: env.PAGINATION_DEFAULT_LIMIT,
    maxLimit: env.PAGINATION_MAX_LIMIT
  });

  return next();
};
