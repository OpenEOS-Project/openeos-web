'use client';

import { useTranslations } from 'next-intl';

import type { ChannelReport } from '@/types/report';
import { formatCurrency } from '@/utils/format';
import { downloadCsv } from './csv-export';

interface ReportsChannelsTableProps {
  data: ChannelReport[] | undefined;
  isLoading: boolean;
}

const CHANNEL_LABELS: Record<string, string> = {
  pos: 'Kasse',
  online: 'Online-Shop',
  qr_order: 'QR-Bestellung',
};

function getChannelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function ReportsChannelsTable({ data, isLoading }: ReportsChannelsTableProps) {
  const t = useTranslations('reports');

  const handleExport = () => {
    if (!data?.length) return;
    const headers = [
      t('channels.columns.channel'),
      t('channels.columns.orders'),
      t('channels.columns.revenue'),
      t('channels.columns.avgReceipt'),
    ];
    const rows = data.map((c) => [getChannelLabel(c.channel), c.orders, c.revenue, c.avgReceipt]);
    downloadCsv('umsatz-nach-kanal.csv', headers, rows);
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('channels.title')}</h2>
          <p className="app-card__sub">{t('channels.subtitle')}</p>
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
          <h3 className="empty-state__title">{t('channels.empty')}</h3>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('channels.columns.channel')}</th>
                <th className="text-right">{t('channels.columns.orders')}</th>
                <th className="text-right">{t('channels.columns.revenue')}</th>
                <th className="text-right">{t('channels.columns.avgReceipt')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.channel}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                      {getChannelLabel(c.channel)}
                    </div>
                  </td>
                  <td className="mono text-right">{c.orders}</td>
                  <td className="mono text-right">{formatCurrency(c.revenue)}</td>
                  <td className="mono text-right">{formatCurrency(c.avgReceipt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
