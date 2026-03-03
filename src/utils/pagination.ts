export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

export const parsePagination = (
  query: PaginationQuery,
  defaults: { page: number; limit: number; maxLimit: number }
): PaginationResult => {
  const rawPage = Number(query.page ?? defaults.page);
  const rawLimit = Number(query.limit ?? defaults.limit);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : defaults.page;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), defaults.maxLimit)
      : defaults.limit;

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

export const toPaginatedData = <T>(
  items: T[],
  totalItems: number,
  page: number,
  limit: number
) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return {
    items,
    page,
    limit,
    totalItems,
    totalPages
  };
};
