import type { EventBilling, EventInvoiceStatus } from '@/types/billing';

/**
 * Der Status, wie ihn die Oberfläche zeigt.
 *
 * Stripe kennt kein "überfällig": eine Rechnung bleibt `open`, bis sie
 * bezahlt oder storniert ist. Die API leitet `overdue` zwar schon selbst ab,
 * aber eine Liste, die über Mitternacht offen steht, soll nicht bis zum
 * nächsten Laden "offen" sagen.
 */
export function invoiceDisplayStatus(
  status: string,
  dueAt: string | null | undefined,
  now: Date = new Date(),
): string {
  if (status === 'open' && dueAt && new Date(dueAt).getTime() < now.getTime()) {
    return 'overdue';
  }
  return status;
}

/** Ob sich die Rechnung noch bezahlen lässt (Stripes Rechnungsseite). */
export function isInvoicePayable(status: string): boolean {
  return status === 'open' || status === 'overdue';
}

/**
 * Was beim Storno einer Freischaltung auf Rechnung passiert:
 * - `invoice_open`: Stripe-Rechnung noch nicht bezahlt — sie wird storniert.
 * - `invoice_paid`: schon bezahlt — Stornorechnung und Erstattung.
 * - `invoice_manual`: Altfall ohne Stripe-Rechnung — wie bisher von Hand.
 */
export type InvoiceCancellationPath = 'invoice_open' | 'invoice_paid' | 'invoice_manual';

export function invoiceCancellationPath(billing: Pick<EventBilling, 'invoice'>): InvoiceCancellationPath {
  const status: EventInvoiceStatus | undefined = billing.invoice?.status;
  if (!status) return 'invoice_manual';
  return status === 'paid' ? 'invoice_paid' : 'invoice_open';
}
