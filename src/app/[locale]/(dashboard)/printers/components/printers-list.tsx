'use client';

import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { usePrinters, useTestPrint } from '@/hooks/use-printers';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';

const typeBadgeClass: Record<string, string> = {
  receipt: 'badge badge--info',
  kitchen: 'badge badge--warning',
  label: 'badge badge--neutral',
};

export function PrintersList() {
  const t = useTranslations('printers');
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId ?? '';

  const { data: printers, isLoading } = usePrinters(organizationId);
  const testPrintMutation = useTestPrint(organizationId);

  if (isLoading) return <ListLoading />;

  if (!printers || printers.length === 0) {
    return (
      <ListEmpty
        title={t('noPrinters')}
        description="Die Drucker werden vom Plattform-Administrator hinzugefügt und deiner Organisation zugewiesen."
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
        }
      />
    );
  }

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('tabs.printers')}</h2>
          <p className="app-card__sub">{printers.length} {t('tabs.printers')}</p>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.name')}</th>
              <th>{t('table.type')}</th>
              <th>{t('table.connection')}</th>
              <th>{t('table.device')}</th>
              <th>{t('table.status')}</th>
              <th className="text-right">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {printers.map((printer) => (
              <tr key={printer.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: 'color-mix(in oklab, var(--ink) 6%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', margin: 0 }}>{printer.name}</p>
                      <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', margin: 0 }}>
                        {printer.paperWidth}mm
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={typeBadgeClass[printer.type] ?? 'badge badge--neutral'}>
                    {t(`types.${printer.type}`)}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                    {t(`connectionTypes.${printer.connectionType}`)}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                    {printer.device ? printer.device.name : '-'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: printer.isOnline ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 30%, transparent)',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                      {printer.isOnline ? t('online') : t('offline')}
                    </span>
                  </div>
                </td>
                <td className="text-right">
                  <button
                    className="btn btn--ghost"
                    style={{ fontSize: 13 }}
                    disabled={!printer.isOnline || testPrintMutation.isPending}
                    onClick={() => testPrintMutation.mutate(printer.id)}
                  >
                    {t('testPrint')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
