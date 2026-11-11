'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Icon, type DataColumn, type RowAction } from '@openeos/ui';

import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';
import { AdminTable, CellMain, CellText, ListAction, ListHead } from '@/components/shared/admin-table';
import '@/styles/admin-table-wave2.css';
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

  const columns: DataColumn<TokenType>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (type) => (
        <CellMain
          media={
            <span className="token-swatch" style={type.color ? { background: type.color } : undefined} aria-hidden="true" />
          }
          title={type.name}
          titleText={type.name}
          sub={type.inUse ? t('inUse') : undefined}
        />
      ),
    },
    { id: 'value', header: t('table.value'), num: true, mobile: 'trailing', cell: (type) => formatCurrency(Number(type.value)) },
    { id: 'kind', header: t('table.kind'), mobile: 'subtitle', cell: (type) => kindBadge(type) },
    {
      id: 'event',
      header: t('table.event'),
      mobile: 'meta',
      cell: (type) => {
        const restricted = type.allowedCategoryIds.length + type.allowedProductIds.length > 0;
        const name = eventName(type.eventId);
        return (
          <span className="token-event">
            <CellText title={name}>{name}</CellText>
            {restricted && (
              <small>
                {t('restrictedSummary', {
                  categories: type.allowedCategoryIds.length,
                  products: type.allowedProductIds.length,
                })}
              </small>
            )}
          </span>
        );
      },
    },
    {
      id: 'buyback',
      header: t('table.buyback'),
      priority: 2,
      cell: (type) =>
        type.buybackAllowed ? (
          <span className="badge badge--neutral">{t('buyback.allowed')}</span>
        ) : (
          <span className="admin-cell-text--muted">{t('buyback.notAllowed')}</span>
        ),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'meta',
      cell: (type) =>
        type.isActive ? (
          <span className="badge badge--success">{t('status.active')}</span>
        ) : (
          <span className="badge badge--neutral">{t('status.inactive')}</span>
        ),
    },
  ];

  const actions = (type: TokenType): RowAction[] => [
    { id: 'edit', label: t('actions.edit'), icon: 'edit', onClick: () => onEditClick(type) },
    {
      // Benutzte Marken werden nur deaktiviert, nicht gelöscht.
      id: type.inUse ? 'deactivate' : 'delete',
      label: type.inUse ? t('actions.deactivate') : t('actions.delete'),
      icon: type.inUse ? 'ban' : 'trash',
      danger: true,
      onClick: () => onDeleteClick(type),
    },
  ];

  return (
    <div className="app-card app-card--flat" data-testid="token-type-list">
      <ListHead
        actions={
          <ListAction
            variant="primary"
            icon="plus"
            label={t('create')}
            onClick={onCreateClick}
            data-testid="token-type-create"
          />
        }
      >
        <h2 className="app-card__title">{t('types.title')}</h2>
        <p className="app-card__sub">{t('count', { count: types.length })}</p>
      </ListHead>

      <AdminTable
        caption={t('types.title')}
        rows={types}
        rowKey="id"
        columns={columns}
        actions={actions}
        rowClassName={(type) => (type.isActive ? undefined : 'admin-dt__row--muted')}
      />
    </div>
  );
}
