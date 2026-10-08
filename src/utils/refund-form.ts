import type {
  CancelItemsData,
  CreateRefundData,
  OrderDetail,
  OrderDetailItem,
  OrderDetailPayment,
  RefundReasonCode,
} from '@/types/order-history';

import { cancellableQuantity, isStarted, paymentKey, round2 } from './order-history';

/**
 * Formularlogik für Storno und Erstattung — gemeinsam für die Kasse
 * (Blätter im Bestellverlauf) und die Verwaltung (Bestelldetail). Reine
 * Funktionen: Zustand rein, Ansicht und Anfrage raus. Der Server rechnet
 * exakt (Rabatt, Pfand, Teilzahlungen); die Vorschau hier nur für die
 * Anzeige.
 */

export type RefundMode = 'items' | 'amount' | 'full';

export interface RefundPreset {
  mode: RefundMode;
  /** Positionen zugleich stornieren (Storno bezahlter Bestellungen). */
  cancelItems: boolean;
}

export interface RefundFormState {
  mode: RefundMode;
  cancelItems: boolean;
  /** Menge je Position (`orderItemId`). */
  qty: Record<string, number>;
  /** Freier Betrag als Eingabe („4,50“). */
  amount: string;
  includeDeposit: boolean;
  /** `auto` = jüngste Zahlung zuerst, sonst die Zahlung. */
  paymentId: string;
  reasonCode: RefundReasonCode | null;
  reasonText: string;
  confirmStarted: boolean;
}

/** Was die Rückgabe auslöst: bar, SumUp-API, manuell (fremdes Gerät), Testmodus. */
export type RefundMethodKey = 'cash' | 'sumup' | 'card' | 'test';

export interface RefundFormView {
  /** Zahlungen, über die noch etwas erstattet werden kann. */
  payments: OrderDetailPayment[];
  chosenPayment: OrderDetailPayment | null;
  /** Höchstbetrag (gewählte Zahlung oder ganze Bestellung). */
  maxAmount: number;
  /** Zahlung, deren Zahlart den Rückgabeweg bestimmt. */
  methodPayment: OrderDetailPayment | null;
  method: RefundMethodKey | null;
  /** Wählbare Positionen mit Höchstmenge. */
  items: { item: OrderDetailItem; max: number }[];
  selected: { item: OrderDetailItem; max: number }[];
  /** Begonnene Positionen, die mit storniert würden. */
  started: OrderDetailItem[];
  hasDeposit: boolean;
  /** Vorschau des Erstattungsbetrags. */
  preview: number;
  amountValue: number;
  amountInvalid: boolean;
  nothingSelected: boolean;
  /** Alles ausgefüllt (Grund, Auswahl/Betrag, Bestätigung). */
  ready: boolean;
}

/** „4,50“ → 4.5; leer oder ungültig → NaN. */
export function parseAmount(text: string): number {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return NaN;
  return Number(trimmed);
}

export function initialRefundState(order: OrderDetail, preset: RefundPreset): RefundFormState {
  const refundable = order.payments.filter((p) => p.refundable > 0);
  return {
    mode: preset.mode,
    cancelItems: preset.cancelItems,
    qty: {},
    amount: '',
    includeDeposit: true,
    paymentId: refundable.length === 1 ? refundable[0].id : 'auto',
    reasonCode: null,
    reasonText: '',
    confirmStarted: false,
  };
}

/** Rückgabeweg je ursprünglicher Zahlart; Testbestellungen nur gebucht. */
export function refundMethod(
  order: Pick<OrderDetail, 'isTest'>,
  payment: Pick<OrderDetailPayment, 'paymentMethod'> | null
): RefundMethodKey | null {
  if (!payment) return null;
  const key = paymentKey(payment.paymentMethod);
  if (order.isTest && key !== 'cash') return 'test';
  return key;
}

export function refundFormView(order: OrderDetail, state: RefundFormState): RefundFormView {
  const payments = order.payments.filter((p) => p.refundable > 0);
  const chosenPayment = payments.find((p) => p.id === state.paymentId) ?? null;
  const maxAmount = chosenPayment ? chosenPayment.refundable : order.refundable;
  const methodPayment =
    chosenPayment ?? [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  const items = order.items
    .map((item) => ({
      item,
      max: state.cancelItems ? cancellableQuantity(item) : item.refundableQuantity,
    }))
    .filter((x) => x.max > 0);
  const selected = items.filter(({ item }) => (state.qty[item.id] ?? 0) > 0);
  const started = !state.cancelItems
    ? []
    : state.mode === 'full'
      ? order.items.filter((item) => cancellableQuantity(item) > 0 && isStarted(item.status))
      : selected.filter(({ item }) => isStarted(item.status)).map(({ item }) => item);
  const hasDeposit = selected.some(({ item }) => item.depositAmount > 0);

  const amountValue = parseAmount(state.amount);
  let preview: number;
  if (state.mode === 'full') {
    preview = order.refundable;
  } else if (state.mode === 'amount') {
    preview = Math.min(amountValue > 0 ? amountValue : 0, maxAmount);
  } else {
    const sum = selected.reduce((s, { item }) => {
      const n = state.qty[item.id] ?? 0;
      const deposit = state.cancelItems || state.includeDeposit ? item.depositAmount * n : 0;
      return s + item.unitRefund * n + deposit;
    }, 0);
    preview = Math.min(round2(sum), order.refundable);
  }

  const amountInvalid =
    state.mode === 'amount' && (!(amountValue > 0) || amountValue > maxAmount + 0.001);
  const nothingSelected = state.mode === 'items' && selected.length === 0;
  const ready =
    !!state.reasonCode &&
    !nothingSelected &&
    !amountInvalid &&
    (started.length === 0 || state.confirmStarted);

  return {
    payments,
    chosenPayment,
    maxAmount,
    methodPayment,
    method: refundMethod(order, methodPayment),
    items,
    selected,
    started,
    hasDeposit,
    preview: round2(preview),
    amountValue,
    amountInvalid,
    nothingSelected,
    ready,
  };
}

/** Anfrage für `POST …/refunds` (ohne Bediener/PIN und `clientRequestId`). */
export function refundPayload(
  state: RefundFormState,
  view: Pick<RefundFormView, 'selected' | 'started' | 'amountValue'>,
  manual: boolean
): CreateRefundData {
  const { mode, cancelItems } = state;
  return {
    mode,
    reasonCode: state.reasonCode!,
    ...(state.reasonText.trim() ? { reasonText: state.reasonText.trim() } : {}),
    ...(mode === 'items'
      ? {
          items: view.selected.map(({ item }) => ({
            orderItemId: item.id,
            quantity: state.qty[item.id],
          })),
        }
      : {}),
    ...(mode === 'amount' ? { amount: round2(view.amountValue) } : {}),
    ...(mode !== 'amount' && cancelItems ? { cancelItems: true } : {}),
    ...(mode === 'items' && !cancelItems && !state.includeDeposit ? { includeDeposit: false } : {}),
    ...(state.paymentId !== 'auto' ? { paymentId: state.paymentId } : {}),
    ...(view.started.length ? { confirmStarted: true } : {}),
    ...(manual ? { manual: true } : {}),
  };
}

// ── Positionen stornieren (ohne Erstattung) ──────────────────────────

export interface CancelItemsState {
  qty: Record<string, number>;
  reasonCode: RefundReasonCode | null;
  reasonText: string;
  confirmStarted: boolean;
}

export interface CancelItemsView {
  items: OrderDetailItem[];
  selected: OrderDetailItem[];
  started: OrderDetailItem[];
  /** Alle Positionen in voller Menge gewählt. */
  all: boolean;
  count: number;
  /** Warenwert der Auswahl (Listenpreis inkl. Optionen). */
  value: number;
  /** Begonnene Positionen brauchen Grund und Bestätigung. */
  needsReason: boolean;
  ready: boolean;
}

/** Stornierbare Positionen (aktiv, nicht erstattet). */
export function cancellableItems(order: OrderDetail): OrderDetailItem[] {
  return order.items.filter((i) => cancellableQuantity(i) > 0);
}

/** Eine einzige Position ist gleich vorgewählt. */
export function initialCancelItemsState(order: OrderDetail): CancelItemsState {
  const items = cancellableItems(order);
  return {
    qty: items.length === 1 ? { [items[0].id]: cancellableQuantity(items[0]) } : {},
    reasonCode: null,
    reasonText: '',
    confirmStarted: false,
  };
}

export function cancelItemsView(order: OrderDetail, state: CancelItemsState): CancelItemsView {
  const items = cancellableItems(order);
  const selected = items.filter((i) => (state.qty[i.id] ?? 0) > 0);
  const started = selected.filter((i) => isStarted(i.status));
  const all = items.length > 0 && items.every((i) => (state.qty[i.id] ?? 0) === cancellableQuantity(i));
  const count = selected.reduce((s, i) => s + (state.qty[i.id] ?? 0), 0);
  const value = round2(
    selected.reduce((s, i) => s + (i.unitPrice + i.optionsPrice) * (state.qty[i.id] ?? 0), 0)
  );
  const needsReason = started.length > 0;
  const ready = count > 0 && (!needsReason || (state.confirmStarted && !!state.reasonCode));
  return { items, selected, started, all, count, value, needsReason, ready };
}

/** Alle wählen bzw. Auswahl leeren. */
export function toggleAllCancelItems(view: CancelItemsView): Record<string, number> {
  return view.all ? {} : Object.fromEntries(view.items.map((i) => [i.id, cancellableQuantity(i)]));
}

/** Anfrage für `POST …/cancel-items` (ohne Bediener/PIN). */
export function cancelItemsPayload(state: CancelItemsState, view: CancelItemsView): CancelItemsData {
  return {
    items: view.selected.map((i) => ({ orderItemId: i.id, quantity: state.qty[i.id] })),
    ...(state.reasonCode ? { reasonCode: state.reasonCode } : {}),
    ...(state.reasonText.trim() ? { reasonText: state.reasonText.trim() } : {}),
    ...(view.started.length ? { confirmStarted: true } : {}),
  };
}
