'use client';

import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/types/product';
import type { SelectedOption } from '@/types/order';

export interface CartItem {
  id: string; // Unique cart item ID
  product: Product;
  quantity: number;
  notes: string;
  kitchenNotes: string;
  selectedOptions: SelectedOption[];
  unitPrice: number; // Base price + options price
}

interface CartState {
  items: CartItem[];
  eventId: string | null;
  tableNumber: string;
  customerName: string;
  notes: string;
}

interface CartActions {
  addItem: (product: Product, quantity?: number, selectedOptions?: SelectedOption[]) => void;
  updateItemQuantity: (cartItemId: string, quantity: number) => void;
  updateItemNotes: (cartItemId: string, notes: string, kitchenNotes?: string) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  setEventId: (eventId: string | null) => void;
  setTableNumber: (tableNumber: string) => void;
  setCustomerName: (customerName: string) => void;
  setNotes: (notes: string) => void;
  getTotal: () => number;
  getItemCount: () => number;
}

const generateCartItemId = () => `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const calculateUnitPrice = (product: Product, selectedOptions: SelectedOption[]): number => {
  const optionsPrice = selectedOptions.reduce((sum, opt) => sum + opt.priceModifier, 0);
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
          // Add new item
          const newItem: CartItem = {
            id: generateCartItemId(),
            product,
            quantity,
            notes: '',
            kitchenNotes: '',
            selectedOptions,
            unitPrice: calculateUnitPrice(product, selectedOptions),
          };
          set({ items: [...state.items, newItem] });
        }
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
        });
      },

      setEventId: (eventId) => {
        // Clear cart when event changes
        const currentEventId = get().eventId;
        if (currentEventId !== eventId) {
          set({ eventId, items: [] });
        } else {
          set({ eventId });
        }
      },

      setTableNumber: (tableNumber) => set({ tableNumber }),
      setCustomerName: (customerName) => set({ customerName }),
      setNotes: (notes) => set({ notes }),

      getTotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
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
