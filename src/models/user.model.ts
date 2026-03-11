import { Schema, model } from 'mongoose';

import type { MembershipTier, Role } from '@/types/domain';

export interface UserDocument {
  email: string;
  passwordHash: string;
  isActive: boolean;
  fullName?: string;
  phone?: string;
  role: Role;
  avatarUrl?: string;
  loyaltyPoints: number;
  membershipTier: MembershipTier;
  staffDepartment?: string;
  staffStartDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    fullName: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: ['customer', 'staff', 'admin'],
      default: 'customer'
    },
    avatarUrl: {
      type: String,
      trim: true
    },
    loyaltyPoints: {
      type: Number,
      default: 0
    },
    membershipTier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze'
    },
    staffDepartment: {
      type: String,
      trim: true
    },
    staffStartDate: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel = model<UserDocument>('User', userSchema);
