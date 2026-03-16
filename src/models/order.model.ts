import { Schema, type Types, model } from 'mongoose';

import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/domain';

export interface OrderItemSnapshot {
  productId: Types.ObjectId;
  productName: string;
  variantId: Types.ObjectId;
  variantSku: string;
  variantColor: string;
  productImage?: string;
  quantity: number;
  price: number;
  total: number;
}

export interface OrderStatusHistory {
  status: OrderStatus;
  changedBy: Types.ObjectId;
  note?: string;
  changedAt: Date;
}

export interface OrderDocument {
  orderCode: string;
  userId: Types.ObjectId;
  shippingRecipientName: string;
  shippingPhone: string;
  shippingAddress: string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentTxnRef?: string;
  paymentTransactionNo?: string;
  paymentGatewayResponseCode?: string;
  paidAt?: Date;
  refundedAt?: Date;
  voucherId?: Types.ObjectId;
  status: OrderStatus;
  items: OrderItemSnapshot[];
  statusHistory: OrderStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<OrderItemSnapshot>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    variantSku: { type: String, required: true },
    variantColor: { type: String, required: true },
    productImage: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const statusHistorySchema = new Schema<OrderStatusHistory>(
  {
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled', 'returned'],
      required: true
    },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const orderSchema = new Schema<OrderDocument>(
  {
    orderCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    shippingRecipientName: { type: String, required: true },
    shippingPhone: { type: String, required: true },
    shippingAddress: { type: String, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['cod', 'banking', 'momo', 'vnpay'], default: 'cod' },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentTxnRef: { type: String, trim: true, uppercase: true },
    paymentTransactionNo: { type: String, trim: true },
    paymentGatewayResponseCode: { type: String, trim: true },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled', 'returned'],
      default: 'pending'
    },
    items: { type: [orderItemSchema], default: [] },
    statusHistory: { type: [statusHistorySchema], default: [] }
  },
  { timestamps: true }
);

orderSchema.index({ orderCode: 1 }, { unique: true });
orderSchema.index({ paymentTxnRef: 1 }, { unique: true, sparse: true });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export const OrderModel = model<OrderDocument>('Order', orderSchema);
