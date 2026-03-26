import type { Role } from '@/types/domain';
import { model, Schema, type Types } from 'mongoose';
import { required } from 'zod/v4/core/util.cjs';

interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionDocument {
  userId: Types.ObjectId;
  role: Role;
  endpoint: string;
  expirationTime?: number | null;
  keys: PushSubscriptionKeys;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<PushSubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['customer', 'staff', 'admin'],
      required: true
    },
    endpoint: { type: String, required: true, unique: true, trim: true },
    expirationTime: { type: Number, default: null },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    userAgent: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });
pushSubscriptionSchema.index({ userId: 1, role: 1 });
pushSubscriptionSchema.index({ role: 1 });

export const PushSubscriptionModel = model<PushSubscriptionDocument>(
  'PushSubscription',
  pushSubscriptionSchema
);
