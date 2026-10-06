'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';

import {
  formatChatTimestamp,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatTime,
  toIntlLocale,
} from '@/utils/format';

/**
 * Locale fuer Intl und toLocale*String, abgeleitet aus der Sprache der
 * Oberflaeche ('en' -> 'en-GB', siehe toIntlLocale). Wer direkt mit Intl
 * formatiert, nimmt diesen Wert statt useLocale().
 */
export function useIntlLocale(): string {
  return toIntlLocale(useLocale());
}

/**
 * Formatierer aus utils/format, gebunden an die Sprache der Oberflaeche.
 *
 * Die Verwaltung hat Datum, Zahlen und Betraege bisher fest mit 'de-DE'
 * formatiert — in der englischen Oberflaeche stand dann "06.10.2026" und
 * "3,50 €" neben englischem Text. Server-Komponenten holen die Sprache mit
 * getLocale() aus next-intl/server und rufen die Utils direkt auf.
 *
 * `locale` ist die Intl-Locale ('en-GB'), nicht der Sprachcode der Route.
 */
export function useLocaleFormat() {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale: toIntlLocale(locale),
      formatCurrency: (amount: number | string) => formatCurrency(amount, locale),
      formatDate: (date: string | Date | null | undefined) => formatDate(date, locale),
      formatDateTime: (date: string | Date | null | undefined) => formatDateTime(date, locale),
      formatTime: (date: string | Date) => formatTime(date, locale),
      formatNumber: (num: number) => formatNumber(num, locale),
      formatPercent: (value: number, fractionDigits?: number) => formatPercent(value, locale, fractionDigits),
      formatChatTimestamp: (date: string | Date) => formatChatTimestamp(date, locale),
    }),
    [locale],
  );
}
