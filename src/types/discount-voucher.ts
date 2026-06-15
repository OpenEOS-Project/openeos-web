export type DiscountVoucherType = 'fixed' | 'manual';

export interface DiscountVoucher {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  type: DiscountVoucherType;
  /** Discount amount in EUR. Set for `fixed` vouchers, null for `manual` ones. */
  amount: number | null;
  isActive: boolean;
  /** Whether the voucher may be applied more than once to the same order. */
  allowMultiplePerOrder: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiscountVoucherData {
  name: string;
  description?: string;
  type: DiscountVoucherType;
  amount?: number;
  isActive?: boolean;
  allowMultiplePerOrder?: boolean;
  sortOrder?: number;
}

export interface UpdateDiscountVoucherData {
  name?: string;
  description?: string | null;
  type?: DiscountVoucherType;
  amount?: number;
  isActive?: boolean;
  allowMultiplePerOrder?: boolean;
  sortOrder?: number;
}
