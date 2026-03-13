import { Schema, Types, model } from 'mongoose';

export interface CartItemDocument {
  productId: Types.ObjectId;
  quantity: number;
  selectedAttributes?: Record<string, unknown>;
}

export interface CartDocument {
  userId: Types.ObjectId;
  items: CartItemDocument[];
  updatedAt: Date;
}

const cartItemSchema = new Schema<CartItemDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, default: 1, min: 1 },
    selectedAttributes: { type: Schema.Types.Mixed }
  },
  {
    _id: false
  }
);

const cartSchema = new Schema<CartDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] }
  },
  {
    timestamps: { createdAt: false, updatedAt: true }
  }
);

export const CartModel = model<CartDocument>('Cart', cartSchema);
