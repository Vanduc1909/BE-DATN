export type Role = 'customer' | 'staff' | 'admin';

export type MembershipTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type VoucherDiscountType = 'percentage' | 'fixed_amount';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type PaymentMethod = 'cod' | 'banking' | 'momo' | 'vnpay';

export type ZalopayChannel = 'gateway' | 'wallet' | 'bank_card' | 'atm';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type ReturnRequestStatus = 'pending' | 'approved' | 'rejected' | 'refunded';

export type CancelRefundRequestStatus = 'pending' | 'rejected' | 'refunded';

export type RefundMethod = 'bank_transfer' | 'wallet';

export type InventoryReason = 'import' | 'sale' | 'return' | 'adjustment' | 'damage';

export type CommentTargetModel = 'product';

export type EmployeeProgressStatus = 'enrolled' | 'in_progress' | 'completed';
