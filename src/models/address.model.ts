import { Schema, Types, model } from 'mongoose';

export interface AddressDocument {
  userId: Types.ObjectId;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  district: string;
  ward: string;
  isDefault: boolean;
}

const addressSchema = new Schema<AddressDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    label: {
      type: String,
      default: 'Home'
    },
    recipientName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    district: {
      type: String,
      required: true,
      trim: true
    },
    ward: {
      type: String,
      required: true,
      trim: true
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: false
  }
);

addressSchema.index({ userId: 1, isDefault: 1 });

export const AddressModel = model<AddressDocument>('Address', addressSchema);
