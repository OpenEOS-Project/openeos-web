'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OrderDetail } from '@/types/order-history';
import {
  type CancelItemsState,
  type RefundFormState,
  type RefundPreset,
  cancelItemsPayload,
  cancelItemsView,
  initialCancelItemsState,
  initialRefundState,
  refundFormView,
  refundPayload,
} from '@/utils/refund-form';

/**
 * Zustand des Erstattungsformulars — Kasse und Verwaltung teilen sich
 * Auswahl, Vorschau, Pflichtfelder und die Anfrage (siehe
 * `utils/refund-form.ts`). Öffnen mit `preset`, `null` = geschlossen.
 */
export function useRefundForm(order: OrderDetail, preset: RefundPreset | null) {
  const [state, setState] = useState<RefundFormState>(() =>
    initialRefundState(order, preset ?? { mode: 'items', cancelItems: false })
  );
  const requestIds = useRef(new Map<string, string>());

  useEffect(() => {
    if (!preset) return;
    setState(initialRefundState(order, preset));
    requestIds.current.clear();
    // Nur beim Öffnen: preset wechselt dabei.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const view = useMemo(() => refundFormView(order, state), [order, state]);

  const set = useCallback(
    <K extends keyof RefundFormState>(key: K, value: RefundFormState[K]) =>
      setState((s) => ({ ...s, [key]: value })),
    []
  );

  /** Menge einer Position, begrenzt auf 0 … max. */
  const setQty = useCallback((itemId: string, value: number, max: number) => {
    setState((s) => ({ ...s, qty: { ...s.qty, [itemId]: Math.max(0, Math.min(max, value)) } }));
  }, []);

  const payload = (manual: boolean) => refundPayload(state, view, manual);

  /** Gleiche Anfrage nach Netzfehler = dieselbe Erstattung (idempotent). */
  const clientRequestId = (body: object) => {
    const key = JSON.stringify(body);
    const id = requestIds.current.get(key) ?? crypto.randomUUID();
    requestIds.current.set(key, id);
    return id;
  };

  return { state, view, set, setQty, payload, clientRequestId };
}

/** Zustand von „Positionen stornieren“ (ohne Erstattung). */
export function useCancelItemsForm(order: OrderDetail, open: boolean) {
  const [state, setState] = useState<CancelItemsState>(() => initialCancelItemsState(order));

  useEffect(() => {
    if (!open) return;
    setState(initialCancelItemsState(order));
    // Nur beim Öffnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const view = useMemo(() => cancelItemsView(order, state), [order, state]);

  const set = useCallback(
    <K extends keyof CancelItemsState>(key: K, value: CancelItemsState[K]) =>
      setState((s) => ({ ...s, [key]: value })),
    []
  );

  const setQty = useCallback((itemId: string, value: number, max: number) => {
    setState((s) => ({ ...s, qty: { ...s.qty, [itemId]: Math.max(0, Math.min(max, value)) } }));
  }, []);

  const payload = () => cancelItemsPayload(state, view);

  return { state, view, set, setQty, payload };
}
