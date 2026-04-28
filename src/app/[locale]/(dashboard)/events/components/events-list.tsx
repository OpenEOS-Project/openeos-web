'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useEvents } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
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
  const tCommon = useTranslations('common');
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: events, isLoading, error } = useEvents(organizationId);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
            </svg>
          </div>
          <h3 className="empty-state__title">Keine Organisation ausgewählt</h3>
          <p className="empty-state__sub">Bitte wählen Sie zuerst eine Organisation aus.</p>
        </div>
      </div>
    );
  }

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
        <div style={{ color: '#d24545' }}>{tCommon('error')}</div>
        <button className="btn btn--ghost" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
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
    if (!endDate) return start;
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onEditClick(event)}>
                      {t('actions.edit')}
                    </button>
                    {(event.status === 'inactive' || event.status === 'test') && (
                      <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onActivateClick(event)}>
                        {t('actions.activate')}
                      </button>
                    )}
                    {event.status === 'inactive' && (
                      <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onSetTestModeClick(event)}>
                        {t('actions.testMode')}
                      </button>
                    )}
                    {(event.status === 'active' || event.status === 'test') && (
                      <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onDeactivateClick(event)}>
                        {t('actions.deactivate')}
                      </button>
                    )}
                    <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12, color: '#d24545' }} onClick={() => onDeleteClick(event)}>
                      {t('actions.delete')}
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
