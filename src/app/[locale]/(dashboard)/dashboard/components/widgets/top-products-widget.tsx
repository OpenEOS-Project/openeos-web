'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useProductsReport } from '@/hooks/use-reports';
import { formatCurrency } from '@/utils/format';
import { useDashboardRange } from '../dashboard-range';

interface Props {
  organizationId: string;
}

export function TopProductsWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');
  const range = useDashboardRange();

  const { data, isLoading } = useProductsReport(organizationId, range.query);

  const top5 = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [data]);

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('widgets.topProducts.label')}</h2>
          <p className="app-card__sub">{t('widgets.topProducts.subtitle', { period: t(`range.period.${range.key}`) })}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="widget-state">
          <span className="oe-spinner" />
        </div>
      ) : top5.length === 0 ? (
        <div className="widget-state">
          <p className="empty-state__sub">{t('widgets.empty')}</p>
        </div>
      ) : (
        /* Rangliste statt fuenfspaltiger Tabelle: fuer fuenf Zeilen
           trug die Tabelle mehr Kopfzeile als Inhalt. Menge und
           Kategorie stehen jetzt als Beizeile unter dem Namen. */
        <div className="oe-list">
          {top5.map((row, i) => (
            <div className="oe-list__row" key={row.productId}>
              <span className="oe-rank">{i + 1}</span>
              <div className="oe-list__main">
                <b>{row.productName}</b>
                <span>
                  {t('widgets.topProducts.soldCount', { count: row.quantitySold })}
                  {row.categoryName ? ` · ${row.categoryName}` : ''}
                </span>
              </div>
              <span className="oe-mono">{formatCurrency(row.revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
