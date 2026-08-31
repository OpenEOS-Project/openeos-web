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

  const { data, isLoading } = useProductsReport(organizationId, range);

  const top5 = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [data]);

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('widgets.topProducts.label')}</h2>
          <p className="app-card__sub">{t('widgets.topProducts.subtitle')}</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : top5.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 0' }}>
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
