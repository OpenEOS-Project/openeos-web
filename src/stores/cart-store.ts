'use client';

import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/types/product';
import type { SelectedOption } from '@/types/order';

export interface CartItemPfandType {
  id: string;
  name: string;
  amount: number;
}

export interface CartItem {
  id: string; // Unique cart item ID
  product: Product;
  quantity: number;
  notes: string;
  kitchenNotes: string;
  selectedOptions: SelectedOption[];
  unitPrice: number; // Base price + options price
  pfandType: CartItemPfandType | null; // Deposit snapshot from the product
  isRefill: boolean; // "Nachfüllen": skip deposit for this line
}

export interface AppliedVoucher {
  uid: string; // Unique per application instance (a voucher may be applied multiple times)
  id: string; // DiscountVoucher id
  name: string;
  amount: number; // Resolved discount in EUR (fixed value, or amount entered for manual vouchers)
  allowMultiple?: boolean; // Whether this voucher may be applied more than once per order
}

interface CartState {
  items: CartItem[];
  eventId: string | null;
  tableNumber: string;
  customerName: string;
  notes: string;
  appliedVouchers: AppliedVoucher[];
}

interface CartActions {
  addItem: (product: Product, quantity?: number, selectedOptions?: SelectedOption[]) => void;
  updateItemQuantity: (cartItemId: string, quantity: number) => void;
  updateItemNotes: (cartItemId: string, notes: string, kitchenNotes?: string) => void;
  setItemRefill: (cartItemId: string, isRefill: boolean) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  setEventId: (eventId: string | null) => void;
  setTableNumber: (tableNumber: string) => void;
  setCustomerName: (customerName: string) => void;
  setNotes: (notes: string) => void;
  applyVoucher: (voucher: Omit<AppliedVoucher, 'uid'>) => void;
  removeVoucher: (voucherUid: string) => void;
  clearVouchers: () => void;
  getTotal: () => number;
  getDiscount: () => number;
  getNetTotal: () => number;
  getPfandTotal: () => number;
  getPayableTotal: () => number;
  getItemCount: () => number;
}

const generateCartItemId = () => `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const calculateUnitPrice = (product: Product, selectedOptions: SelectedOption[]): number => {
  const optionsPrice = selectedOptions
    .filter((opt) => !opt.excluded)
    .reduce((sum, opt) => sum + opt.priceModifier, 0);
  return Number(product.price) + optionsPrice;
};

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      // State
      items: [],
      eventId: null,
      tableNumber: '',
      customerName: '',
      notes: '',
      appliedVouchers: [],

      // Actions
      addItem: (product, quantity = 1, selectedOptions = []) => {
        const state = get();

        // Check if same product with same options exists
        const existingItem = state.items.find(
          (item) =>
            item.product.id === product.id &&
            JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions)
        );

        if (existingItem) {
          // Increment quantity
          set({
            items: state.items.map((item) =>
              item.id === existingItem.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
          });
        } else {
          // Add new item — snapshot the product's deposit type (if any)
          const pfandType: CartItemPfandType | null = product.pfandType
            ? {
                id: product.pfandType.id,
                name: product.pfandType.name,
                amount: Number(product.pfandType.amount),
              }
            : null;
          const newItem: CartItem = {
            id: generateCartItemId(),
            product,
            quantity,
            notes: '',
            kitchenNotes: '',
            selectedOptions,
            unitPrice: calculateUnitPrice(product, selectedOptions),
            pfandType,
            isRefill: false,
          };
          set({ items: [...state.items, newItem] });
        }
      },

      setItemRefill: (cartItemId, isRefill) => {
        set({
          items: get().items.map((item) =>
            item.id === cartItemId ? { ...item, isRefill } : item
          ),
        });
      },

      updateItemQuantity: (cartItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartItemId);
          return;
        }
        set({
          items: get().items.map((item) =>
            item.id === cartItemId ? { ...item, quantity } : item
          ),
        });
      },

      updateItemNotes: (cartItemId, notes, kitchenNotes) => {
        set({
          items: get().items.map((item) =>
            item.id === cartItemId
              ? { ...item, notes, ...(kitchenNotes !== undefined && { kitchenNotes }) }
              : item
          ),
        });
      },

      removeItem: (cartItemId) => {
        set({ items: get().items.filter((item) => item.id !== cartItemId) });
      },

      clearCart: () => {
        set({
          items: [],
          tableNumber: '',
          customerName: '',
          notes: '',
          appliedVouchers: [],
        });
      },

      setEventId: (eventId) => {
        // Clear cart when event changes
        const currentEventId = get().eventId;
        if (currentEventId !== eventId) {
          set({ eventId, items: [], appliedVouchers: [] });
        } else {
          set({ eventId });
        }
      },

      setTableNumber: (tableNumber) => set({ tableNumber }),
      setCustomerName: (customerName) => set({ customerName }),
      setNotes: (notes) => set({ notes }),

      applyVoucher: (voucher) => {
        const existing = get().appliedVouchers;
        // Single-use vouchers may only be applied once; multi-use ones can
        // stack as separate instances (each with its own uid).
        if (!voucher.allowMultiple && existing.some((v) => v.id === voucher.id)) return;
        const uid = `voucher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set({ appliedVouchers: [...existing, { ...voucher, uid }] });
      },

      removeVoucher: (voucherUid) => {
        set({ appliedVouchers: get().appliedVouchers.filter((v) => v.uid !== voucherUid) });
      },

      clearVouchers: () => set({ appliedVouchers: [] }),

      getTotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
      },

      getDiscount: () => {
        const total = get().items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
        const requested = get().appliedVouchers.reduce((sum, v) => sum + v.amount, 0);
        // Cap the discount at the cart total — the difference is never paid out.
        return Math.min(requested, total);
      },

      getNetTotal: () => {
        const total = get().items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
        const requested = get().appliedVouchers.reduce((sum, v) => sum + v.amount, 0);
        return Math.max(total - requested, 0);
      },

      getPfandTotal: () => {
        return get().items.reduce(
          (sum, item) =>
            sum + (item.isRefill || !item.pfandType ? 0 : item.pfandType.amount * item.quantity),
          0
        );
      },

      getPayableTotal: () => {
        const total = get().items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
        const requested = get().appliedVouchers.reduce((sum, v) => sum + v.amount, 0);
        const pfand = get().items.reduce(
          (sum, item) =>
            sum + (item.isRefill || !item.pfandType ? 0 : item.pfandType.amount * item.quantity),
          0
        );
        // Products minus discount (floored at 0), plus deposits on top.
        return Math.max(total - requested, 0) + pfand;
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'openeos-cart',
      partialize: (state) => ({
        items: state.items,
        eventId: state.eventId,
        tableNumber: state.tableNumber,
        customerName: state.customerName,
        notes: state.notes,
        appliedVouchers: state.appliedVouchers,
      }),
    }
  )
);

// Hydration helpers
export const waitForCartHydration = () => {
  return new Promise<void>((resolve) => {
    if (useCartStore.persist.hasHydrated()) {
      resolve();
    } else {
      const unsubscribe = useCartStore.persist.onFinishHydration(() => {
        unsubscribe();
        resolve();
      });
    }
  });
};

export const useCartHydration = () => {
  const [hasHydrated, setHasHydrated] = useState(useCartStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useCartStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    // Check again in case it hydrated between render and effect
    if (useCartStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }

    return unsubscribe;
  }, []);

  return hasHydrated;
};
