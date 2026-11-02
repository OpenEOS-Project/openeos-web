'use client';

import { useTranslations } from 'next-intl';

import { useOperatingMode } from '@/hooks/use-operating-mode';

/** Untertitel der Auswertung — im Modus „Nur Bons“ ohne „Umsatz“. */
export function ReportsSubtitle() {
  const t = useTranslations('reports');
  const orderOnly = useOperatingMode().ordersOnly;
  return <p className="app-page-head__sub">{orderOnly ? t('orderOnly.pageSubtitle') : t('subtitle')}</p>;
}
