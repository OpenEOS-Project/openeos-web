'use client';

import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { useCartStore } from '@/stores/cart-store';

// Mirrors CartUpdatePayload in openeos-api gateway-events.dto.ts
export interface CustomerCartItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  options: string[];
  pfandAmount: number;
  isRefill: boolean;
}

export interface CustomerCartPayload {
  status: 'active' | 'completed';
  kind?: 'paid' | 'tab';
  orderNumber?: string | null;
  items: CustomerCartItem[];
  totals: {
    subtotal: number;
    discount: number;
    pfand: number;
    payable: number;
  };
  vouchers: { name: string; amount: number }[];
  updatedAt: number;
}

interface OrderCompletedSignalState {
  seq: number;
  kind: 'paid' | 'tab';
  orderNumber: string | null;
  notify: (kind: 'paid' | 'tab', orderNumber: string | null) => void;
}

const useOrderCompletedSignal = create<OrderCompletedSignalState>((set) => ({
  seq: 0,
  kind: 'paid',
  orderNumber: null,
  notify: (kind, orderNumber) =>
    set((state) => ({ seq: state.seq + 1, kind, orderNumber })),
}));

/**
 * Call right BEFORE clearCart() after a successful checkout so the customer
 * display can show a thank-you screen with the final totals.
 */
export function notifyCustomerDisplayOrderCompleted(
  kind: 'paid' | 'tab',
  orderNumber: string | null,
) {
  useOrderCompletedSignal.getState().notify(kind, orderNumber);
}

function buildSnapshot(chargePfand: boolean): CustomerCartPayload {
  const state = useCartStore.getState();

  const items: CustomerCartItem[] = state.items.map((item) => ({
    id: item.id,
    name: item.product.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.unitPrice * item.quantity,
    options: item.selectedOptions.map((opt) =>
      opt.excluded ? `ohne ${opt.option}` : opt.option,
    ),
    pfandAmount:
      chargePfand && !item.isRefill && item.pfandType ? item.pfandType.amount : 0,
    isRefill: item.isRefill,
  }));

  const subtotal = state.getTotal();
  const discount = state.getDiscount();
  const pfand = chargePfand ? state.getPfandTotal() : 0;
  const payable = chargePfand ? state.getPayableTotal() : state.getNetTotal();

  return {
    status: 'active',
    items,
    totals: { subtotal, discount, pfand, payable },
    vouchers: state.appliedVouchers.map((v) => ({ name: v.name, amount: v.amount })),
    updatedAt: Date.now(),
  };
}

const EMIT_THROTTLE_MS = 150;

/**
 * Broadcasts the live POS cart over the device socket so paired customer
 * displays (settings.posDeviceId) can mirror it. The gateway relays the
 * payload to the org-scoped room of this POS device.
 */
export function useCustomerDisplayBroadcast(
  socket: Socket | null,
  isConnected: boolean,
  chargePfand: boolean,
) {
  const lastSnapshotRef = useRef<CustomerCartPayload | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastEmitAt = 0;

    const emit = (payload: CustomerCartPayload) => {
      lastEmitAt = Date.now();
      socket.emit('cartUpdate', payload);
    };

    const emitCartThrottled = () => {
      const send = () => {
        const snapshot = buildSnapshot(chargePfand);
        lastSnapshotRef.current = snapshot;
        emit(snapshot);
      };
      const elapsed = Date.now() - lastEmitAt;
      if (timer) clearTimeout(timer);
      if (elapsed >= EMIT_THROTTLE_MS) {
        send();
      } else {
        timer = setTimeout(send, EMIT_THROTTLE_MS - elapsed);
      }
    };

    // Initial snapshot on connect / config change
    emitCartThrottled();

    // A display (re)subscribed — push the current cart immediately so it
    // doesn't stay blank until the next cart mutation.
    const handleSnapshotRequest = () => {
      if (timer) clearTimeout(timer);
      const snapshot = buildSnapshot(chargePfand);
      lastSnapshotRef.current = snapshot;
      emit(snapshot);
    };
    socket.on('cartSnapshotRequested', handleSnapshotRequest);

    const unsubCart = useCartStore.subscribe(() => emitCartThrottled());

    const unsubCompleted = useOrderCompletedSignal.subscribe((state, prev) => {
      if (state.seq === prev.seq) return;
      // Send the final cart (signal fires before clearCart) as a completed order
      if (timer) clearTimeout(timer);
      const fresh = buildSnapshot(chargePfand);
      const base = fresh.items.length > 0 ? fresh : (lastSnapshotRef.current ?? fresh);
      emit({
        ...base,
        status: 'completed',
        kind: state.kind,
        orderNumber: state.orderNumber,
        updatedAt: Date.now(),
      });
    });

    return () => {
      if (timer) clearTimeout(timer);
      socket.off('cartSnapshotRequested', handleSnapshotRequest);
      unsubCart();
      unsubCompleted();
    };
  }, [socket, isConnected, chargePfand]);
}
