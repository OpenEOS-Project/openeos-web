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
  // "Nachfüllen": how many of this line's units are refills (guest brought their
  // own container) and therefore carry NO deposit. 0 = all units get a deposit,
  // quantity = whole line is a refill. Always clamped to 0..quantity.
  refillCount: number;
}

/** A deposit return that is being offset ("verrechnet") against the current
 *  sale instead of paid out in cash. Snapshotted from a PfandType. */
export interface CartPfandReturnLine {
  pfandTypeId: string;
  name: string;
  unitAmount: number;
  quantity: number;
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
  // Deposit returns offset against this sale (entered via the Pfand-Rückgabe
  // modal → "Verrechnen"). Reduce the net deposit charged + the token count.
  pfandReturns: CartPfandReturnLine[];
}

interface CartActions {
  addItem: (product: Product, quantity?: number, selectedOptions?: SelectedOption[]) => void;
  updateItemQuantity: (cartItemId: string, quantity: number) => void;
  updateItemNotes: (cartItemId: string, notes: string, kitchenNotes?: string) => void;
  setItemRefillCount: (cartItemId: string, refillCount: number) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  setEventId: (eventId: string | null) => void;
  setTableNumber: (tableNumber: string) => void;
  setCustomerName: (customerName: string) => void;
  setNotes: (notes: string) => void;
  applyVoucher: (voucher: Omit<AppliedVoucher, 'uid'>) => void;
  removeVoucher: (voucherUid: string) => void;
  clearVouchers: () => void;
  setPfandReturns: (lines: CartPfandReturnLine[]) => void;
  clearPfandReturns: () => void;
  getTotal: () => number;
  getDiscount: () => number;
  getNetTotal: () => number;
  /** Gross deposit on new (non-refill) units in the cart, before offsetting. */
  getPfandTotal: () => number;
  /** Count of new deposit tokens before offsetting (Σ quantity − refillCount). */
  getNewPfandUnits: () => number;
  /** Deposit value being offset against this sale (Σ verrechnete Rückgabe). */
  getReturnedPfandTotal: () => number;
  /** Count of returned tokens being offset. */
  getReturnedPfandUnits: () => number;
  /** Which new deposit units get offset by returns, per cart item, + the
   *  value credited. Replayed at checkout so payable == backend order total. */
  getPfandOffset: () => { convertedSum: number; byItem: Record<string, number> };
  /** Net deposit charged = max(gross − offset, 0). */
  getNetPfandTotal: () => number;
  /** Net tokens to hand out = new − returned (negative ⇒ take tokens back). */
  getNetPfandUnits: () => number;
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
      pfandReturns: [],

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
            refillCount: 0,
          };
          set({ items: [...state.items, newItem] });
        }
      },

      setItemRefillCount: (cartItemId, refillCount) => {
        set({
          items: get().items.map((item) =>
            item.id === cartItemId
              ? { ...item, refillCount: Math.max(0, Math.min(refillCount, item.quantity)) }
              : item
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
            item.id === cartItemId
              ? { ...item, quantity, refillCount: Math.min(item.refillCount, quantity) }
              : item
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
          pfandReturns: [],
        });
      },

      setEventId: (eventId) => {
        // Clear cart when event changes
        const currentEventId = get().eventId;
        if (currentEventId !== eventId) {
          set({ eventId, items: [], appliedVouchers: [], pfandReturns: [] });
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

      setPfandReturns: (lines) =>
        set({ pfandReturns: lines.filter((l) => l.quantity > 0) }),

      clearPfandReturns: () => set({ pfandReturns: [] }),

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
        // Deposit on new units only — refilled units (guest's own container)
        // carry no deposit. depositUnits = quantity − refillCount.
        return get().items.reduce((sum, item) => {
          if (!item.pfandType) return sum;
          const depositUnits = Math.max(item.quantity - item.refillCount, 0);
          return sum + item.pfandType.amount * depositUnits;
        }, 0);
      },

      getNewPfandUnits: () => {
        return get().items.reduce((sum, item) => {
          if (!item.pfandType) return sum;
          return sum + Math.max(item.quantity - item.refillCount, 0);
        }, 0);
      },

      getReturnedPfandTotal: () => {
        return get().pfandReturns.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0);
      },

      getReturnedPfandUnits: () => {
        return get().pfandReturns.reduce((sum, l) => sum + l.quantity, 0);
      },

          // Offset returned deposit against the cart's NEW deposit units by
      // converting whole units to "refills". Returns the value actually
      // credited (convertedSum) and which units per cart item were converted —
      // the SAME conversion is replayed at checkout so the displayed payable
      // and the backend order total always match to the cent.
      getPfandOffset: () => {
        const target = get().getReturnedPfandTotal();
        const byItem: Record<string, number> = {};
        let remaining = target;
        let convertedSum = 0;
        if (remaining <= 0) return { convertedSum, byItem };
        for (const item of get().items) {
          if (!item.pfandType) continue;
          const amount = item.pfandType.amount;
          let units = Math.max(item.quantity - item.refillCount, 0);
          while (units > 0 && remaining >= amount - 1e-9) {
            remaining -= amount;
            convertedSum += amount;
            byItem[item.id] = (byItem[item.id] || 0) + 1;
            units--;
          }
        }
        return { convertedSum, byItem };
      },

      getNetPfandTotal: () => {
        return Math.max(get().getPfandTotal() - get().getPfandOffset().convertedSum, 0);
      },

      getNetPfandUnits: () => {
        return get().getNewPfandUnits() - get().getReturnedPfandUnits();
      },

      getPayableTotal: () => {
        const total = get().items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
        const requested = get().appliedVouchers.reduce((sum, v) => sum + v.amount, 0);
        // Products minus discount (floored at 0), plus the NET deposit after
        // offsetting any returned deposit ("verrechnet") against new deposits.
        return Math.max(total - requested, 0) + get().getNetPfandTotal();
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'openeos-cart',
      version: 1,
      // v0 carts had a boolean `isRefill` per item and no `pfandReturns`.
      // Map the boolean onto the new per-unit `refillCount` (true ⇒ whole line).
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version < 1) {
          const items = (state.items as Array<Record<string, unknown>>) ?? [];
          state.items = items.map((item) => ({
            ...item,
            refillCount:
              (item.refillCount as number | undefined) ??
              (item.isRefill ? (item.quantity as number) : 0),
          }));
          state.pfandReturns = (state.pfandReturns as unknown[]) ?? [];
        }
        return state as unknown as CartState;
      },
      partialize: (state) => ({
        items: state.items,
        eventId: state.eventId,
        tableNumber: state.tableNumber,
        customerName: state.customerName,
        notes: state.notes,
        appliedVouchers: state.appliedVouchers,
        pfandReturns: state.pfandReturns,
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
