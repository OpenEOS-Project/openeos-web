'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useProductionStations } from '@/hooks/use-production-stations';
import type { ProductionStation } from '@/types/production-station';

interface ProductionStationsListProps {
  eventId: string;
  onCreateClick: () => void;
  onEditClick: (station: ProductionStation) => void;
  onDeleteClick: (station: ProductionStation) => void;
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid var(--green-ink)', borderTopColor: 'transparent',
        animation: 'spin 0.75s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function ProductionStationsList({
  eventId,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: ProductionStationsListProps) {
  const t = useTranslations('productionStations');
  const tCommon = useTranslations('common');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: stations, isLoading, error } = useProductionStations(eventId);

  if (isLoading) return <Spinner />;

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
        <p style={{ color: '#d24545', fontSize: 14 }}>{tCommon('error')}</p>
        <button className="btn btn--ghost" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  if (!stations || stations.length === 0) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('empty.title')}</h3>
          <p className="empty-state__sub">{t('empty.description')}</p>
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        </div>
      </div>
    );
  }

  const stationMap = new Map(stations.map((s) => [s.id, s.name]));

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('title')}</h2>
          <p className="app-card__sub">{t('subtitle')}</p>
        </div>
        <button className="btn btn--primary" onClick={onCreateClick}>
          {t('create')}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.name')}</th>
              <th>{t('table.handoffStation')}</th>
              <th>{t('table.printer')}</th>
              <th>{t('table.displayDevice')}</th>
              <th>{t('table.status')}</th>
              <th className="text-right">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((station) => (
              <tr key={station.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: station.color || '#9ca3af',
                    }} />
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', margin: 0 }}>{station.name}</p>
                      {station.description && (
                        <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', margin: 0, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {station.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                    {station.handoffStationId ? (stationMap.get(station.handoffStationId) || '-') : t('form.noHandoff')}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                    {station.printer?.name || '-'}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                    {station.displayDevice?.name || '-'}
                  </span>
                </td>
                <td>
                  <span className={station.isActive ? 'badge badge--success' : 'badge badge--neutral'}>
                    {station.isActive ? t('form.active') : 'Inaktiv'}
                  </span>
                </td>
                <td className="text-right">
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      className="btn btn--ghost"
                      style={{ padding: '4px 10px', fontSize: 13 }}
                      onClick={() => setOpenMenuId(openMenuId === station.id ? null : station.id)}
                    >
                      ···
                    </button>
                    {openMenuId === station.id && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpenMenuId(null)} />
                        <div style={{
                          position: 'absolute', right: 0, top: '100%', zIndex: 20,
                          background: 'var(--paper)', border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                          borderRadius: 10, boxShadow: '0 8px 24px color-mix(in oklab, var(--ink) 12%, transparent)',
                          minWidth: 140, padding: '4px 0',
                        }}>
                          <button
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
                            onClick={() => { setOpenMenuId(null); onEditClick(station); }}
                          >
                            {tCommon('edit')}
                          </button>
                          <div style={{ height: 1, background: 'color-mix(in oklab, var(--ink) 8%, transparent)', margin: '4px 0' }} />
                          <button
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#d24545' }}
                            onClick={() => { setOpenMenuId(null); onDeleteClick(station); }}
                          >
                            {tCommon('delete')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
