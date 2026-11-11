'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';
import { useEvents } from '@/hooks/use-events';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useTokenTypes } from '@/hooks/use-token-types';
import { formatRate, tokenKindBadge } from '@/lib/token-admin';
import type { TokenType } from '@/types/token';

interface TokenTypeListProps {
  organizationId: string;
  onCreateClick: () => void;
  onEditClick: (type: TokenType) => void;
  onDeleteClick: (type: TokenType) => void;
}

/** Markentypen als Tabelle (wie Pfand): Farbe, Nennwert, Art, Veranstaltung, Rücktausch, Status. */
export function TokenTypeList({ organizationId, onCreateClick, onEditClick, onDeleteClick }: TokenTypeListProps) {
  const t = useTranslations('tokens');
  const locale = useLocale();
  const { formatCurrency } = useLocaleFormat();
  const { data: types, isLoading, error, refetch } = useTokenTypes(organizationId);
  const { data: events = [] } = useEvents(organizationId);

  if (isLoading) return <ListLoading />;
  if (error) return <ListError onRetry={() => void refetch()} />;

  if (!types || types.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={<Icon name="ticket" size={28} />}
        action={
          <button className="btn btn--primary" onClick={onCreateClick} data-testid="token-type-create">
            {t('create')}
          </button>
        }
      />
    );
  }

  const eventName = (eventId: string | null) =>
    eventId ? (events.find((e) => e.id === eventId)?.name ?? t('unknownEvent')) : t('allEvents');

  const kindBadge = (type: TokenType) => {
    const badge = tokenKindBadge(type);
    return badge.key === 'single' ? (
      <span className="badge badge--warning">
        {t('kind.single', { rate: badge.rate === null ? '–' : formatRate(badge.rate, locale) })}
      </span>
    ) : (
      <span className="badge badge--info">{t('kind.multi')}</span>
    );
  };

  return (
    <div className="app-card app-card--flat" data-testid="token-type-list">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('types.title')}</h2>
          <p className="app-card__sub">{t('count', { count: types.length })}</p>
        </div>
        <button className="btn btn--primary" onClick={onCreateClick} data-testid="token-type-create">
          {t('create')}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.name')}</th>
              <th className="text-right">{t('table.value')}</th>
              <th>{t('table.kind')}</th>
              <th>{t('table.event')}</th>
              <th>{t('table.buyback')}</th>
              <th>{t('table.status')}</th>
              <th style={{ width: 120 }}>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => {
              const restricted = type.allowedCategoryIds.length + type.allowedProductIds.length > 0;
              return (
                <tr key={type.id} data-testid={`token-type-row-${type.id}`}>
                  <td>
                    <div className="token-name">
                      <span
                        className="token-swatch"
                        style={type.color ? { background: type.color } : undefined}
                        aria-hidden="true"
                      />
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                        {type.name}
                        {type.inUse && <small>{t('inUse')}</small>}
                      </span>
                    </div>
                  </td>
                  <td className="mono text-right">{formatCurrency(Number(type.value))}</td>
                  <td>{kindBadge(type)}</td>
                  <td style={{ fontSize: 13 }}>
                    {eventName(type.eventId)}
                    {restricted && (
                      <div style={{ fontSize: 11, color: 'var(--oe-mute)' }}>
                        {t('restrictedSummary', {
                          categories: type.allowedCategoryIds.length,
                          products: type.allowedProductIds.length,
                        })}
                      </div>
                    )}
                  </td>
                  <td>
                    {type.buybackAllowed ? (
                      <span className="badge badge--neutral">{t('buyback.allowed')}</span>
                    ) : (
                      <span style={{ color: 'var(--oe-mute)' }}>{t('buyback.notAllowed')}</span>
                    )}
                  </td>
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
                        aria-label={type.inUse ? t('actions.deactivate') : t('actions.delete')}
                        title={type.inUse ? t('actions.deactivate') : t('actions.delete')}
                      >
                        <Icon name={type.inUse ? 'ban' : 'trash'} size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
