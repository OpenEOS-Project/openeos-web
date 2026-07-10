'use client';

import { useTranslations } from 'next-intl';

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
}: EventsListProps) {
  const t = useTranslations('events');
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: events, isLoading, error } = useEvents(organizationId);

  if (!organizationId) {
    return (
      <ListEmpty
        title="Keine Organisation ausgewählt"
        description="Bitte wählen Sie zuerst eine Organisation aus."
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
          </svg>
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
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
    return new Date(dateString).toLocaleDateString('de-DE', {
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                    {event.settings?.shop?.enabled && (
                      <a
                        className="btn btn--ghost"
                        style={{ padding: 6, minWidth: 0, color: 'var(--green-ink)' }}
                        href={shopUrlForEvent(event.id)}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label="Shop öffnen"
                        title="Shop öffnen"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                      </a>
                    )}
                    {(event.status === 'inactive' || event.status === 'test') && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ padding: 6, minWidth: 0, color: 'var(--green-ink)' }}
                        onClick={() => onActivateClick(event)}
                        aria-label={t('actions.activate')}
                        title={t('actions.activate')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4" /></svg>
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2v6L4 20a2 2 0 0 0 1.8 2.8h12.4A2 2 0 0 0 20 20L15 8V2" /><line x1="9" y1="2" x2="15" y2="2" /><line x1="7" y1="14" x2="17" y2="14" /></svg>
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
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
