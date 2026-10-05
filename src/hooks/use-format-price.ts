'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';

import { formatCurrency } from '@/utils/format';

/**
 * Betrag in Euro, formatiert nach der Sprache der Oberflaeche.
 *
 * Die Geraeteansichten haben bisher fest 'de-DE' benutzt — auf einer
 * englisch eingestellten Kasse stand dann "3,50 €" neben englischem Text.
 * Die Waehrung bleibt Euro; nur Trennzeichen und Stellung folgen der
 * Sprache.
 */
export function useFormatPrice() {
  const locale = useLocale();
  return useCallback((amount: number | string) => formatCurrency(amount, locale), [locale]);
}
