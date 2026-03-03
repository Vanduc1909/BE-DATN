import { Schema, Types, model } from 'mongoose';

export interface CategoryDocument {
  name: string;
  slug: string;
  description?: string;
  parentId?: Types.ObjectId;
  image?: string;
  isActive: boolean;
}

const categorySchema = new Schema<CategoryDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    description: {
      type: String
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category'
    },
    image: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

categorySchema.index({ slug: 1 }, { unique: true });

export const CategoryModel = model<CategoryDocument>('Category', categorySchema);
