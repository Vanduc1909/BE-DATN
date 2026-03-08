import bcrypt from 'bcryptjs';import { StatusCodes } from 'http-status-codes';import type { Role } from '@/types/domain';import { UserModel, type UserDocument } from '@models/user.model';import { ApiError } from '@utils/api-error';import { toObjectId } from '@utils/object-id';import { toPaginatedData } from '@utils/pagination';type UserWithId = UserDocument & { _id: unknown };interface CreateUserInput {  email: string;  password: string;  username?: string;  fullName?: string;  phone?: string;  role?: Role;}interface UpdateUserInput {  username?: string;  fullName?: string;  phone?: string;  role?: Role;  isActive?: boolean;  avatarUrl?: string;  loyaltyPoints?: number;  membershipTier?: UserDocument['membershipTier'];  staffDepartment?: string;  staffStartDate?: Date;  password?: string;}const toPublicUser = (user: UserWithId) => ({  id: String(user._id),  email: user.email,  username: user.username,  isActive: user.isActive !== false,  fullName: user.fullName,  phone: user.phone,  role: user.role,  avatarUrl: user.avatarUrl,  loyaltyPoints: user.loyaltyPoints,  membershipTier: user.membershipTier,  staffDepartment: user.staffDepartment,  staffStartDate: user.staffStartDate,  createdAt: user.createdAt,  updatedAt: user.updatedAt});const normalizeEmail = (email: string) => email.trim().toLowerCase();const normalizeUsername = (username?: string) => username?.trim().toLowerCase();const ensureNoConflict = async (email: string, username?: string, excludedUserId?: string) => {  const filters: Array<Record<string, string>> = [{ email }];  if (username) {    filters.push({ username });  }  const query: Record<string, unknown> = {    $or: filters  };  if (excludedUserId) {  import { z } from 'zod';

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
    username: z.string().min(3).max(50).optional(),
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
      username: z.string().min(3).max(50).optional(),
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