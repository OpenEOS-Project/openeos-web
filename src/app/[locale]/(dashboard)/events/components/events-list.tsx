'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { Building, ExternalLink, FlaskConical, Pause, Play } from 'lucide-react';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { useEvents } from '@/hooks/use-events';
import { shopUrlForEvent } from '@/lib/shop-url';
import { useAuthStore } from '@/stores/auth-store';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import type { Event, EventStatus } from '@/types';

interface EventsListProps {
  onCreateClick: () => void;
  onEditClick: (event: Event) => void;
  onDeleteClick: (event: Event) => void;
  onActivateClick: (event: Event) => void;
  onDeactivateClick: (event: Event) => void;
  onSetTestModeClick: (event: Event) => void;
  /** Event currently being checked/activated — shows a busy state on its activate button. */
  activatingEventId?: string | null;
}

const statusBadge: Record<EventStatus, string> = {
  active: 'badge badge--success',
  inactive: 'badge badge--neutral',
  test: 'badge badge--warning',
};

export function EventsList({
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onActivateClick,
  onDeactivateClick,
  onSetTestModeClick,
  activatingEventId,
}: EventsListProps) {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const locale = useIntlLocale();
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: events, isLoading, error } = useEvents(organizationId);

  if (!organizationId) {
    return (
      <ListEmpty
        title={tCommon('noOrganization.title')}
        description={tCommon('noOrganization.description')}
        icon={
          <Building size={28} />
        }
      />
    );
  }

  if (isLoading) {
    return <ListLoading />;
  }

  if (error) {
    return <ListError />;
  }

  if (!events || events.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Icon name="calendar" size={28} />
        }
        action={
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        }
      />
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate) return '-';
    const start = formatDate(startDate);
    // Eintägige Veranstaltungen: nur ein Datum anzeigen (Altbestand kann mehrtägig sein)
    if (!endDate || formatDate(endDate) === start) return start;
    return `${start} – ${formatDate(endDate)}`;
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          {/* Titel und Untertitel standen schon im Seitenkopf darueber; hier
              steht wie bei den Geraeten nur die Anzahl. */}
          <p style={{ fontSize: 13, color: 'var(--ink)', opacity: .6 }}>{t('count', { count: events.length })}</p>
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
              <th>{t('table.status')}</th>
              <th>{t('table.date')}</th>
              <th style={{ width: 160 }}>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                      color: 'var(--green-ink)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon name="calendar" size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{event.name}</div>
                      {event.description && (
                        <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                          {event.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span className={statusBadge[event.status]}>
                    {t(`status.${event.status}`)}
                  </span>
                </td>
                <td className="mono">{formatDateTime(event.startDate, event.endDate)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0 }}
                      onClick={() => onEditClick(event)}
                      aria-label={t('actions.edit')}
                      title={t('actions.edit')}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    {event.settings?.shop?.enabled && (
                      <a
                        className="btn btn--ghost"
                        style={{ padding: 6, minWidth: 0, color: 'var(--green-ink)' }}
                        href={shopUrlForEvent(event.id)}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={t('actions.openShop')}
                        title={t('actions.openShop')}
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                    {(event.status === 'inactive' || event.status === 'test') && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ padding: 6, minWidth: 0, color: 'var(--green-ink)', opacity: activatingEventId === event.id ? 0.5 : 1 }}
                        onClick={() => onActivateClick(event)}
                        disabled={activatingEventId === event.id}
                        aria-label={t('actions.activate')}
                        title={t('actions.activate')}
                      >
                        <Play size={16} />
                      </button>
                    )}
                    {event.status === 'inactive' && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ padding: 6, minWidth: 0 }}
                        onClick={() => onSetTestModeClick(event)}
                        aria-label={t('actions.testMode')}
                        title={t('actions.testMode')}
                      >
                        <FlaskConical size={16} />
                      </button>
                    )}
                    {(event.status === 'active' || event.status === 'test') && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ padding: 6, minWidth: 0 }}
                        onClick={() => onDeactivateClick(event)}
                        aria-label={t('actions.deactivate')}
                        title={t('actions.deactivate')}
                      >
                        <Pause size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0, color: 'var(--danger)' }}
                      onClick={() => onDeleteClick(event)}
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
