import { z } from 'zod';

export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    role: z.enum(['customer', 'staff', 'admin']).optional(),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional()
  })
});

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(64),
    fullName: z.string().min(1).max(120).optional(),
    phone: z.string().min(8).max(20).optional(),
    role: z.enum(['customer', 'staff']).optional()
  })
});

export const userIdParamSchema = z.object({
  params: z.object({
    userId: z.string().min(1)
  })
});

export const updateUserSchema = z.object({
  params: z.object({
    userId: z.string().min(1)
  }),
  body: z
    .object({
      fullName: z.string().min(1).max(120).optional(),
      phone: z.string().min(8).max(20).optional(),
      role: z.enum(['customer', 'staff']).optional(),
      isActive: z.boolean().optional(),
      avatarUrl: z.string().url().optional(),
      loyaltyPoints: z.number().int().min(0).optional(),
      membershipTier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
      staffDepartment: z.string().max(120).optional(),
      staffStartDate: z.coerce.date().optional(),
      password: z.string().min(8).max(64).optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required'
    })
});
