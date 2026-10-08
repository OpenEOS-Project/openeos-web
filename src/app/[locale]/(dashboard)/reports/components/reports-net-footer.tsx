'use client';

import { useTranslations } from 'next-intl';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import type { NetLine } from '@/utils/report-net';

interface ReportsNetFooterProps {
  lines: NetLine[];
  /** Spalten vor der Umsatzspalte. */
  labelSpan: number;
  /** Spalten nach der Umsatzspalte. */
  trailing?: number;
  /** Beschriftung der Summenzeile (Produkte bzw. Kategorien). */
  itemsLabel: string;
}

/**
 * Abgleich unter Produkt- und Kategoriebericht: Summe der Zeilen,
 * Erstattungen ohne Position, Trinkgeld, ggf. Rundung, Umsatz netto.
 */
export function ReportsNetFooter({ lines, labelSpan, trailing = 0, itemsLabel }: ReportsNetFooterProps) {
  const t = useTranslations('reports.net');
  const { formatCurrency } = useLocaleFormat();
  return (
    <tfoot>
      {lines.map((line) => {
        const strong = line.key === 'netRevenue';
        return (
          <tr key={line.key} className="report-net__row" data-strong={strong || undefined}>
            <td colSpan={labelSpan}>{line.key === 'items' ? itemsLabel : t(line.key)}</td>
            <td className="mono text-right">{formatCurrency(line.amount)}</td>
            {trailing > 0 && <td colSpan={trailing} />}
          </tr>
        );
      })}
    </tfoot>
  );
}
