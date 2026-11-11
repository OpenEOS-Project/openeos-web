'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { ListAction, ListHead } from '@/components/shared/admin-table';
import '@/styles/admin-table-wave4.css';

interface ReportCardHeadProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onExport: () => void;
  exportDisabled?: boolean;
}

/**
 * Kopf einer Berichtskarte: Titel und Untertitel links, CSV-Export als
 * Symbolknopf (Beschriftung als Tooltip und aria-label) rechts.
 */
export function ReportCardHead({ title, subtitle, onExport, exportDisabled }: ReportCardHeadProps) {
  const t = useTranslations('reports');
  return (
    <ListHead actions={<ListAction icon="download" label={t('export.csv')} onClick={onExport} disabled={exportDisabled} />}>
      <h2 className="app-card__title">{title}</h2>
      {subtitle ? <p className="app-card__sub">{subtitle}</p> : null}
    </ListHead>
  );
}

/**
 * Zahl in Zeile 2 des Telefon-Eintrags: dort steht die Spaltenüberschrift
 * davor („Menge 12“), auf dem Desktop nur die Zahl.
 */
export function PhoneLabel({ label, children }: { label: string; children: ReactNode }) {
  return <span data-phone-label={label}>{children}</span>;
}

/** Ladezustand einer Berichtskarte. */
export function ReportLoading() {
  const t = useTranslations('reports');
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{t('loading')}</div>
    </div>
  );
}
