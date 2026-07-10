'use client';

import { useTranslations } from 'next-intl';

import { usePfandTypes } from '@/hooks/use-pfand-types';
import type { PfandType } from '@/types/pfand';

interface PfandListProps {
  organizationId: string;
  onCreateClick: () => void;
  onEditClick: (type: PfandType) => void;
  onDeleteClick: (type: PfandType) => void;
}

export function PfandList({ organizationId, onCreateClick, onEditClick, onDeleteClick }: PfandListProps) {
  const t = useTranslations('pfand');
  const tCommon = useTranslations('common');

  const { data: types, isLoading, error } = usePfandTypes(organizationId);

  if (isLoading) {
    return (
      <div className="app-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{tCommon('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 24px' }}>
        <div style={{ color: 'var(--danger)' }}>{tCommon('error')}</div>
        <button className="btn btn--ghost" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  if (!types || types.length === 0) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v10M9.5 9.5h3.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3h3.5" />
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

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(amount));

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
              <th className="text-right">{t('table.amount')}</th>
              <th>{t('table.status')}</th>
              <th style={{ width: 120 }}>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type.id}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{type.name}</div>
                </td>
                <td className="mono text-right">{formatAmount(type.amount)}</td>
                <td>
                  {type.isActive ? (
                    <span className="badge badge--success">{t('status.active')}</span>
                  ) : (
                    <span className="badge badge--neutral">{t('status.inactive')}</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0 }}
                      onClick={() => onEditClick(type)}
                      aria-label={t('actions.edit')}
                      title={t('actions.edit')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0, color: 'var(--danger)' }}
                      onClick={() => onDeleteClick(type)}
                      aria-label={t('actions.delete')}
                      title={t('actions.delete')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
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
