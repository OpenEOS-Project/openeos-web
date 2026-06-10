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
  sortOrder?: number;
}

export interface UpdateDiscountVoucherData {
  name?: string;
  description?: string | null;
  type?: DiscountVoucherType;
  amount?: number;
  isActive?: boolean;
  sortOrder?: number;
}
