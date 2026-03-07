import { model, Schema } from 'mongoose';

export interface SizeDocument {
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sizeSchema = new Schema<SizeDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

sizeSchema.index({ slug: 1 }, { unique: true });
sizeSchema.index({ name: 1 });
sizeSchema.index({ isActive: 1 });

export const SizeModel = model<SizeDocument>('Size', sizeSchema);
