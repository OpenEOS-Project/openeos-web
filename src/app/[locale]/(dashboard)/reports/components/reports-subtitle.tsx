'use client';

import { useTranslations } from 'next-intl';

import { useOrderOnly } from '@/hooks/use-order-only';

/** Untertitel der Auswertung — im Modus „Nur Bestellen“ ohne „Umsatz“. */
export function ReportsSubtitle() {
  const t = useTranslations('reports');
  const orderOnly = useOrderOnly();
  return <p className="app-page-head__sub">{orderOnly ? t('orderOnly.pageSubtitle') : t('subtitle')}</p>;
}
