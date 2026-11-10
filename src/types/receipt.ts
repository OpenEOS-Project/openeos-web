import type { PublicLegalInfo } from '@/lib/legal';

/** Baustein eines digitalen Belegs (API: receipt-blocks.ts). */
export type ReceiptBlock =
  | { type: 'banner'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'title'; text: string }
  | { type: 'center'; text: string; muted?: boolean }
  | { type: 'text'; text: string; bold?: boolean; muted?: boolean }
  | { type: 'row'; label: string; value: string; bold?: boolean }
  | { type: 'item'; qty: string; name: string; amount: string }
  | { type: 'rule'; double?: boolean }
  | { type: 'mono'; label?: string; text: string }
  | { type: 'qr'; value: string; caption?: string }
  | { type: 'fill'; label: string; lines: number }
  | { type: 'note'; text: string };

export interface PublicReceipt {
  kind: 'receipt' | 'hospitality';
  orderNumber: string;
  isTest: boolean;
  blocks: ReceiptBlock[];
}

export interface PublicReceiptView {
  organizationName: string;
  expiresAt: string;
  receipts: PublicReceipt[];
  legal: PublicLegalInfo;
}
