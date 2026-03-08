import { z } from 'zod';

export const listCategoriesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional()
  })
});

export const categoryIdParamSchema = z.object({
  params: z.object({
    categoryId: z.string().min(1)
  })
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    slug: z.string().min(1).max(160),
    description: z.string().optional(),
    parentId: z.string().optional(),
    image: z.string().url().optional(),
    isActive: z.boolean().optional()
  })
});

export const updateCategorySchema = z.object({
  params: z.object({
    categoryId: z.string().min(1)
  }),
  body: z
    .object({
      name: z.string().min(1).max(120).optional(),
      slug: z.string().min(1).max(160).optional(),
      description: z.string().optional(),
      parentId: z.string().nullable().optional(),
      image: z.string().url().optional(),
      isActive: z.boolean().optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required'
    })
});