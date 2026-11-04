import { checkoutIncludesTse } from '@/utils/event-tse';

import { isValidTaxNumber, isValidVatId, normalizeVatId } from '@/lib/dsfinvk';

import type {
  EventTseTerms,
  PurchaseMasterDataField,
  PurchaseMasterDataStatus,
  PurchaseMasterDataValues,
} from '@/types/billing';

const FIELDS: readonly PurchaseMasterDataField[] = [
  'legalName',
  'street',
  'zip',
  'city',
  'taxNumber',
  'vatId',
];

/**
 * Was vor dem Bezahlen fehlt — mit der aktuellen Wahl zur Cloud-TSE.
 * Ältere API-Stände liefern nichts: dann gilt alles als vorhanden.
 */
export function missingForCheckout(
  masterData: PurchaseMasterDataStatus | undefined,
  tse: EventTseTerms | undefined,
  answer: boolean | null
): PurchaseMasterDataField[] {
  if (!masterData) return [];
  return checkoutIncludesTse(tse, answer) ? masterData.missingWithTse : masterData.missing;
}

/** `params.missing` aus `PURCHASE_MASTER_DATA_REQUIRED` (kommagetrennt). */
export function parseMissingParam(value: unknown): PurchaseMasterDataField[] {
  if (typeof value !== 'string') return [];
  const parts = value.split(',').map((part) => part.trim());
  return FIELDS.filter((field) => parts.includes(field));
}

export type MasterDataErrorKey = 'required' | 'taxRequired' | 'taxNumberInvalid' | 'vatIdInvalid';

/**
 * Prüft das Formular wie die API: Name und Anschrift immer, mit Cloud-TSE
 * Steuernummer oder USt-IdNr. (deutsches Format); eine eingetragene
 * Nummer muss immer stimmen.
 */
export function validatePurchaseMasterData(
  values: PurchaseMasterDataValues,
  options: { withTse: boolean; country: string | null }
): Partial<Record<keyof PurchaseMasterDataValues, MasterDataErrorKey>> {
  const errors: Partial<Record<keyof PurchaseMasterDataValues, MasterDataErrorKey>> = {};
  for (const key of ['legalName', 'street', 'zip', 'city'] as const) {
    if (!values[key].trim()) errors[key] = 'required';
  }
  const german = (options.country ?? 'DE').toUpperCase() === 'DE';
  const taxNumber = values.taxNumber.trim();
  const vatId = normalizeVatId(values.vatId);
  if (taxNumber && german && !isValidTaxNumber(taxNumber)) errors.taxNumber = 'taxNumberInvalid';
  if (vatId && !isValidVatId(vatId)) errors.vatId = 'vatIdInvalid';
  if (options.withTse && !taxNumber && !vatId) errors.taxNumber = 'taxRequired';
  return errors;
}
