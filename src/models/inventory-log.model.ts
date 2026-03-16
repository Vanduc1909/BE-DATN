import { Schema, Types, model } from 'mongoose';

import type { InventoryReason } from '@/types/domain';

export interface InventoryLogDocument {
  productId: Types.ObjectId;
  variantSku?: string;
  changeAmount: number;
  reason: InventoryReason;
  performedBy: Types.ObjectId;
  note?: string;
  createdAt: Date;
}

const inventoryLogSchema = new Schema<InventoryLogDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String, trim: true },
    changeAmount: { type: Number, required: true },
    reason: {
      type: String,
      enum: ['import', 'sale', 'return', 'adjustment', 'damage'],
      required: true
    },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

inventoryLogSchema.index({ productId: 1, createdAt: -1 });

export const InventoryLogModel = model<InventoryLogDocument>('InventoryLog', inventoryLogSchema);
