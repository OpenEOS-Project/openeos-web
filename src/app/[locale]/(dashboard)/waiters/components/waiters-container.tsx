'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import '@/styles/waiters.css';
import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useEvents } from '@/hooks/use-events';
import { useIntlLocale } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import { useResetWaiterPin, useUpdateWaiter, useWaiters } from '@/hooks/use-waiters';
import { useAuthStore } from '@/stores/auth-store';
import type { Waiter, WaiterWithPin } from '@/types/waiter';

import { WaiterBadge } from './waiter-badge';
import { WaiterFormModal } from './waiter-form-modal';
import { WaitersBulkModal } from './waiters-bulk-modal';
import { PinRevealModal, type RevealedPin } from './pin-reveal-modal';
import { WaiterDeleteDialog } from './waiter-delete-dialog';
import { WaiterSettingsCard } from './waiter-settings-card';

export function WaitersContainer() {
  const t = useTranslations('waiters');
  const tCommon = useTranslations('common');
  const locale = useIntlLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { currentOrganization } = useAuthStore();
  const { isAdmin } = usePermissions();
  const organizationId = currentOrganization?.organizationId ?? '';
  const organizationName = currentOrganization?.organization?.name ?? '';

  const [eventFilter, setEventFilter] = useState<string>('all');
  const [formFor, setFormFor] = useState<Waiter | 'new' | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [revealed, setRevealed] = useState<RevealedPin[] | null>(null);
  const [deleting, setDeleting] = useState<Waiter | null>(null);

  const { data: events = [] } = useEvents(organizationId);
  const list = useWaiters(organizationId || undefined, eventFilter === 'all' ? null : eventFilter);
  const updateWaiter = useUpdateWaiter(organizationId);
  const resetPin = useResetWaiterPin(organizationId);

  const eventName = useMemo(() => {
    const map = new Map(events.map((e) => [e.id, e.name]));
    return (id: string | null) => (id ? (map.get(id) ?? t('scope.event')) : t('scope.organization'));
  }, [events, t]);

  /* Aktive bzw. Test-Veranstaltung: Vorgabe für die Massenanlage. */
  const runningEvent = events.find((e) => e.status === 'active') ?? events.find((e) => e.status === 'test') ?? null;

  if (!organizationId) {
    return (
      <ListEmpty
        title={tCommon('noOrganization.title')}
        description={tCommon('noOrganization.description')}
        icon={<Icon name="users" size={28} />}
      />
    );
  }

  const waiters = list.data?.data ?? [];
  const meta = list.data?.meta;
  const limitLabel = meta
    ? meta.limit === 0
      ? t('limit.unlimited', { count: meta.count })
      : t('limit.used', { count: meta.count, limit: meta.limit })
    : '';

  const reveal = (rows: WaiterWithPin[] | RevealedPin[]) =>
    setRevealed(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        shortName: row.shortName ?? null,
        color: row.color ?? null,
        pin: row.pin,
        eventId: row.eventId ?? null,
      })),
    );

  const handleResetPin = (waiter: Waiter) => {
    resetPin.mutate(
      { id: waiter.id },
      {
        onSuccess: (result) => reveal([{ ...waiter, pin: result.pin }]),
        onError: (error) => toast.error(apiErrorMessage(error, t('errors.pinReset'))),
      },
    );
  };

  const handleToggleActive = (waiter: Waiter) => {
    updateWaiter.mutate(
      { id: waiter.id, data: { isActive: !waiter.isActive } },
      {
        onSuccess: () =>
          toast.success(waiter.isActive ? t('toast.deactivated', { name: waiter.name }) : t('toast.activated', { name: waiter.name })),
        onError: (error) => toast.error(apiErrorMessage(error, tCommon('saveFailed'))),
      },
    );
  };

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '—';

  const toolbar = (
    <div className="waiters-toolbar">
      <label className="waiters-toolbar__filter">
        <span className="oe-sr-only">{t('filter.label')}</span>
        <select className="select" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label={t('filter.label')}>
          <option value="all">{t('filter.all')}</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {t('filter.event', { name: event.name })}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn--ghost" onClick={() => setBulkOpen(true)}>
        <Icon name="users" size={16} />
        {t('actions.bulk')}
      </button>
      <button type="button" className="btn btn--primary" onClick={() => setFormFor('new')}>
        <Icon name="plus" size={16} />
        {t('actions.create')}
      </button>
    </div>
  );

  let body;
  if (list.isLoading) body = <ListLoading />;
  else if (list.error) body = <ListError />;
  else if (waiters.length === 0)
    body = (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={<Icon name="users" size={28} />}
        action={
          <button type="button" className="btn btn--primary" onClick={() => setBulkOpen(true)}>
            {t('actions.bulk')}
          </button>
        }
      />
    );
  else
    body = (
      <div className="waiters-table" style={{ overflowX: 'auto' }}>
        <table className="data-table" data-testid="waiters-table">
          <thead>
            <tr>
              <th>{t('table.name')}</th>
              <th>{t('table.role')}</th>
              <th>{t('table.scope')}</th>
              <th>{t('table.pin')}</th>
              <th>{t('table.lastUsed')}</th>
              <th>{t('table.status')}</th>
              <th>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {waiters.map((waiter) => (
              <tr key={waiter.id} className={waiter.isActive ? undefined : 'is-inactive'}>
                <td>
                  <div className="waiters-name">
                    <WaiterBadge name={waiter.name} color={waiter.color} />
                    <span>
                      <b>{waiter.name}</b>
                      {waiter.shortName && <small>{waiter.shortName}</small>}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${waiter.role === 'lead' ? 'badge--info' : 'badge--neutral'}`}>
                    {t(`roles.${waiter.role}`)}
                  </span>
                </td>
                <td style={{ fontSize: 13 }}>{eventName(waiter.eventId)}</td>
                <td>
                  {waiter.hasPin ? (
                    <span className="badge badge--success">{t('pin.set', { length: waiter.pinLength ?? 4 })}</span>
                  ) : (
                    <span className="badge badge--warning">{t('pin.missing')}</span>
                  )}
                </td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {formatDate(waiter.lastUsedAt)}
                </td>
                <td>
                  <span className={`badge ${waiter.isActive ? 'badge--success' : 'badge--neutral'}`}>
                    {waiter.isActive ? t('status.active') : t('status.inactive')}
                  </span>
                </td>
                <td>
                  <div className="waiters-actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setFormFor(waiter)}
                      aria-label={t('actions.edit', { name: waiter.name })}
                      title={t('actions.edit', { name: waiter.name })}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    {waiter.isActive && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => handleResetPin(waiter)}
                        disabled={resetPin.isPending}
                        aria-label={t('actions.resetPin', { name: waiter.name })}
                        title={t('actions.resetPin', { name: waiter.name })}
                      >
                        <Icon name="refresh" size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => handleToggleActive(waiter)}
                      aria-label={
                        waiter.isActive
                          ? t('actions.deactivate', { name: waiter.name })
                          : t('actions.activate', { name: waiter.name })
                      }
                      title={
                        waiter.isActive
                          ? t('actions.deactivate', { name: waiter.name })
                          : t('actions.activate', { name: waiter.name })
                      }
                    >
                      <Icon name={waiter.isActive ? 'ban' : 'check-circle'} size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => setDeleting(waiter)}
                      aria-label={t('actions.delete', { name: waiter.name })}
                      title={t('actions.delete', { name: waiter.name })}
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
    );

  return (
    <>
      <div className="app-card app-card--flat">
        <div className="app-card__head waiters-head">
          <div>
            <p style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.6, margin: 0 }}>
              {t('count', { count: waiters.length })}
            </p>
            {limitLabel && (
              <p className="waiters-limit" data-testid="waiter-limit">
                {limitLabel}
              </p>
            )}
          </div>
          {toolbar}
        </div>
        {body}
      </div>

      <div className="waiters-hint">
        <Icon name="info" size={16} />
        <p>{t('hint')}</p>
      </div>

      {isAdmin && <WaiterSettingsCard />}

      {formFor && (
        <WaiterFormModal
          organizationId={organizationId}
          waiter={formFor === 'new' ? null : formFor}
          events={events}
          defaultEventId={eventFilter === 'all' ? null : eventFilter}
          onClose={() => setFormFor(null)}
          onCreated={(created) => reveal([created])}
        />
      )}

      {bulkOpen && (
        <WaitersBulkModal
          organizationId={organizationId}
          events={events}
          defaultEventId={runningEvent?.id ?? null}
          onClose={() => setBulkOpen(false)}
          onCreated={(created) => reveal(created)}
        />
      )}

      {revealed && (
        <PinRevealModal
          pins={revealed}
          organizationName={organizationName}
          eventName={(id) => (id ? eventName(id) : null)}
          onClose={() => setRevealed(null)}
        />
      )}

      {deleting && (
        <WaiterDeleteDialog organizationId={organizationId} waiter={deleting} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}
