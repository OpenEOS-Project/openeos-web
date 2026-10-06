'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePfandTypes } from '@/hooks/use-pfand-types';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import type { PfandType } from '@/types/pfand';

interface PfandListProps {
  organizationId: string;
  onCreateClick: () => void;
  onSettingsClick: () => void;
  onEditClick: (type: PfandType) => void;
  onDeleteClick: (type: PfandType) => void;
}

export function PfandList({ organizationId, onCreateClick, onSettingsClick, onEditClick, onDeleteClick }: PfandListProps) {
  const t = useTranslations('pfand');
  const { formatCurrency } = useLocaleFormat();

  const { data: types, isLoading, error } = usePfandTypes(organizationId);

  if (isLoading) {
    return <ListLoading />;
  }

  if (error) {
    return <ListError />;
  }

  if (!types || types.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Icon name="deposit" size={28} />
        }
        action={
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        }
      />
    );
  }

  const formatAmount = (amount: number) => formatCurrency(Number(amount));

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('title')}</h2>
          <p className="app-card__sub">{t('subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={onSettingsClick}>
            {t('settings.trigger')}
          </button>
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        </div>
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
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0, color: 'var(--danger)' }}
                      onClick={() => onDeleteClick(type)}
                      aria-label={t('actions.delete')}
                      title={t('actions.delete')}
                    >
                      <Icon name="trash" size={16} />
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
