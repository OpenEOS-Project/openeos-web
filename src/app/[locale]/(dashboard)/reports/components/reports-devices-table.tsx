'use client';

import { useTranslations } from 'next-intl';

import type { DeviceReport } from '@/types/report';
import { formatCurrency } from '@/utils/format';
import { downloadCsv } from './csv-export';

interface ReportsDevicesTableProps {
  data: DeviceReport[] | undefined;
  isLoading: boolean;
}

export function ReportsDevicesTable({ data, isLoading }: ReportsDevicesTableProps) {
  const t = useTranslations('reports');

  const handleExport = () => {
    if (!data?.length) return;
    const headers = [t('devices.columns.device'), t('devices.columns.orders'), t('devices.columns.revenue')];
    const rows = data.map((d) => [d.name, d.orders, d.revenue]);
    downloadCsv('umsatz-je-kasse.csv', headers, rows);
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('devices.title')}</h2>
          <p className="app-card__sub">{t('devices.subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ fontSize: 13 }}
          onClick={handleExport}
          disabled={!data?.length}
        >
          {t('export.csv')}
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{t('loading')}</div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state__title">{t('devices.empty')}</h3>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('devices.columns.device')}</th>
                <th className="text-right">{t('devices.columns.orders')}</th>
                <th className="text-right">{t('devices.columns.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.deviceId ?? 'unknown'}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{d.name}</div>
                  </td>
                  <td className="mono text-right">{d.orders}</td>
                  <td className="mono text-right">{formatCurrency(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
