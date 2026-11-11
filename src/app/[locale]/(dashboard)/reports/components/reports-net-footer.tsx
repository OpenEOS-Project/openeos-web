'use client';

import { useTranslations } from 'next-intl';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import type { NetLine } from '@/utils/report-net';

interface ReportsNetSummaryProps {
  lines: NetLine[];
  /** Beschriftung der Summenzeile (Produkte bzw. Kategorien). */
  itemsLabel: string;
  /** Hinweis darunter (was „netto“ heißt). */
  note?: string;
}

/**
 * Abgleich unter Produkt- und Kategoriebericht: Summe der Zeilen,
 * Erstattungen ohne Position, Trinkgeld, ggf. Rundung, Umsatz netto.
 * Steht im Fuß der DataTable (die keine Summenzeilen kennt), rechtsbündig
 * wie die Umsatzspalte darüber.
 */
export function ReportsNetSummary({ lines, itemsLabel, note }: ReportsNetSummaryProps) {
  const t = useTranslations('reports.net');
  const { formatCurrency } = useLocaleFormat();
  return (
    <div className="report-net">
      {lines.length > 0 && (
        <dl className="report-net__list">
          {lines.map((line) => (
            <div key={line.key} className="report-net__row" data-strong={line.key === 'netRevenue' || undefined}>
              <dt>{line.key === 'items' ? itemsLabel : t(line.key)}</dt>
              <dd>{formatCurrency(line.amount)}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && <p className="report-net__note">{note}</p>}
    </div>
  );
}
