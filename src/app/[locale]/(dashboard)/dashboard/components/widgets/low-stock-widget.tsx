'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { DataColumn } from '@openeos/ui';
import { AdminTable } from '@/components/shared/admin-table';
import { useInventoryReport } from '@/hooks/use-reports';
import type { InventoryLevel } from '@/types/report';
import { useDashboardRange } from '../dashboard-range';
import '@/styles/admin-table-wave4.css';

interface Props {
  organizationId: string;
}

export function LowStockWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');
  const range = useDashboardRange();

  const { data, isLoading } = useInventoryReport(organizationId, range.query);

  const top5 = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.currentStock - b.currentStock).slice(0, 5);
  }, [data]);

  const columns: DataColumn<InventoryLevel>[] = [
    {
      id: 'product',
      header: t('widgets.lowStock.product'),
      mobile: 'title',
      cell: (row) => <span title={row.productName}>{row.productName}</span>,
    },
    {
      id: 'stock',
      header: t('widgets.lowStock.stock'),
      num: true,
      mobile: 'trailing',
      cell: (row) => <span className={row.lowStock ? 'low-stock__value is-low' : 'low-stock__value'}>{row.currentStock}</span>,
    },
    {
      id: 'status',
      header: t('widgets.lowStock.status'),
      mobile: 'subtitle',
      cell: (row) =>
        row.lowStock ? (
          <span className="badge badge--error">{t('widgets.lowStock.low')}</span>
        ) : (
          <span className="badge badge--success">{t('widgets.lowStock.ok')}</span>
        ),
    },
  ];

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('widgets.lowStock.label')}</h2>
          <p className="app-card__sub">{t('widgets.lowStock.subtitle')}</p>
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
        <AdminTable
          caption={t('widgets.lowStock.label')}
          rows={top5}
          rowKey="productId"
          columns={columns}
        />
      )}
    </div>
  );
}
