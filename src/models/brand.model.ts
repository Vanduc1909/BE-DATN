import { model, Schema } from 'mongoose';

export interface BrandDocument {
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<BrandDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
    description: { type: String },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

brandSchema.index({ slug: 1 }, { unique: true });
brandSchema.index({ name: 1 });
brandSchema.index({ isActive: 1 });

export const BrandModel = model<BrandDocument>('Brand', brandSchema);
