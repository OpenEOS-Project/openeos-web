import { expect, test } from '@playwright/test';

import { invoiceCancellationPath, invoiceDisplayStatus, isInvoicePayable } from '@/utils/stripe-invoice';
import type { EventInvoiceSummary } from '@/types/billing';

const NOW = new Date('2026-10-14T10:00:00.000Z');

function invoice(overrides: Partial<EventInvoiceSummary> = {}): EventInvoiceSummary {
  return {
    id: 'in_1',
    number: 'OE-0001',
    status: 'open',
    dueAt: '2026-10-28T10:00:00.000Z',
    paidAt: null,
    hostedUrl: 'https://invoice.stripe.com/i/test',
    ...overrides,
  };
}

test.describe('invoiceDisplayStatus', () => {
  test('keeps an open invoice open until the due date', () => {
    expect(invoiceDisplayStatus('open', '2026-10-28T10:00:00.000Z', NOW)).toBe('open');
  });

  test('turns an open invoice past its due date into overdue', () => {
    expect(invoiceDisplayStatus('open', '2026-10-13T10:00:00.000Z', NOW)).toBe('overdue');
  });

  test('never marks paid, void or uncollectible invoices as overdue', () => {
    for (const status of ['paid', 'void', 'uncollectible']) {
      expect(invoiceDisplayStatus(status, '2026-10-01T00:00:00.000Z', NOW)).toBe(status);
    }
  });

  test('leaves invoices without a due date alone (online payments)', () => {
    expect(invoiceDisplayStatus('open', null, NOW)).toBe('open');
    expect(invoiceDisplayStatus('paid', undefined, NOW)).toBe('paid');
  });
});

test.describe('isInvoicePayable', () => {
  test('only open and overdue invoices can be paid', () => {
    expect(isInvoicePayable('open')).toBe(true);
    expect(isInvoicePayable('overdue')).toBe(true);
    for (const status of ['paid', 'void', 'uncollectible', 'draft', 'issued']) {
      expect(isInvoicePayable(status)).toBe(false);
    }
  });
});

test.describe('invoiceCancellationPath', () => {
  test('open or overdue Stripe invoice is voided', () => {
    expect(invoiceCancellationPath({ invoice: invoice() })).toBe('invoice_open');
    expect(invoiceCancellationPath({ invoice: invoice({ status: 'overdue' }) })).toBe('invoice_open');
  });

  test('paid Stripe invoice gets a credit note', () => {
    expect(invoiceCancellationPath({ invoice: invoice({ status: 'paid' }) })).toBe('invoice_paid');
  });

  test('legacy invoice orders without a Stripe invoice stay manual', () => {
    expect(invoiceCancellationPath({ invoice: null })).toBe('invoice_manual');
    expect(invoiceCancellationPath({})).toBe('invoice_manual');
  });
});
