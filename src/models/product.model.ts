import { Schema, Types, model } from 'mongoose';

export interface ProductDocument {
  name: string;
  slug: string;
  sku: string;
  categoryId: Types.ObjectId;
  price: number;
  originalPrice?: number;
  description?: string;
  attributes?: Record<string, unknown>;
  images: string[];
  stockQuantity: number;
  isAvailable: boolean;
  metaTitle?: string;
  metaDescription?: string;
  averageRating: number;
  reviewCount: number;
  soldCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    description: { type: String },
    attributes: { type: Schema.Types.Mixed },
    images: [{ type: String }],
    stockQuantity: { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true },
    metaTitle: { type: String },
    metaDescription: { type: String },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 }
  },
  {
    timestamps: true
  }
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ categoryId: 1, isAvailable: 1 });

export const ProductModel = model<ProductDocument>('Product', productSchema);
