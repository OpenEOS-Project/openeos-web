'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, Select, useMediaQuery, type DataColumn, type RowAction } from '@openeos/ui';

import '@/styles/waiters.css';
import '@/styles/admin-table-wave2.css';
import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';
import {
  AdminFilterBar,
  AdminTable,
  CellMain,
  CellText,
  ListAction,
  PHONE_QUERY,
} from '@/components/shared/admin-table';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useEvents } from '@/hooks/use-events';
import { useIntlLocale } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import { useResetWaiterPin, useUpdateWaiter, useWaiters } from '@/hooks/use-waiters';
import { useAuthStore } from '@/stores/auth-store';
import { waitersApi } from '@/lib/api-client';
import { saveBlob } from '@/lib/dsfinvk';
import type { Waiter, WaiterSettlement, WaiterWithPin } from '@/types/waiter';

import { WaiterBadge } from './waiter-badge';
import { WaiterFormModal } from './waiter-form-modal';
import { WaitersBulkModal } from './waiters-bulk-modal';
import { PinRevealModal, type RevealedPin } from './pin-reveal-modal';
import { WaiterDeleteDialog } from './waiter-delete-dialog';
import { WaiterSettingsCard } from './waiter-settings-card';
import { WaiterSettleModal } from './waiter-settle-modal';
import { WaiterSettlementsSection } from './waiter-settlements-section';

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
  const [settling, setSettling] = useState<Waiter | null>(null);
  const [settled, setSettled] = useState<WaiterSettlement | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const phone = useMediaQuery(PHONE_QUERY);

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

  /** Auskunft (Art. 15 DSGVO) als CSV herunterladen. */
  const handleExport = async (waiter: Waiter) => {
    setExporting(waiter.id);
    try {
      const file = await waitersApi.exportData(organizationId, waiter.id);
      saveBlob(file.blob, file.filename ?? `bedienung-${waiter.id.slice(0, 8)}-auskunft.csv`);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('errors.export')));
    } finally {
      setExporting(null);
    }
  };

  const formatDay = (value: string) => new Date(value).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '—';

  const columns: DataColumn<Waiter>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (waiter) => (
        <CellMain
          media={<WaiterBadge name={waiter.name} color={waiter.color} />}
          title={waiter.name}
          titleText={waiter.name}
          sub={waiter.shortName || undefined}
        />
      ),
    },
    {
      id: 'role',
      header: t('table.role'),
      mobile: 'subtitle',
      cell: (waiter) => (
        <span className="waiters-role">
          <span className={`badge ${waiter.role === 'lead' ? 'badge--info' : 'badge--neutral'}`}>
            {t(`roles.${waiter.role}`)}
          </span>
          {waiter.isEmployee && (
            <span className="badge badge--neutral" title={t('form.isEmployee')} data-testid="waiter-employee-badge">
              {t('employeeBadge')}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'scope',
      header: t('table.scope'),
      mobile: 'meta',
      className: 'waiters-list__scope',
      cell: (waiter) => {
        const scope = eventName(waiter.eventId);
        return (
          <CellText muted title={scope}>
            {scope}
          </CellText>
        );
      },
    },
    {
      id: 'pin',
      header: t('table.pin'),
      mobile: 'hidden',
      cell: (waiter) =>
        waiter.hasPin ? (
          <span className="badge badge--success">{t('pin.set', { length: waiter.pinLength ?? 4 })}</span>
        ) : (
          <span className="badge badge--warning">{t('pin.missing')}</span>
        ),
    },
    {
      id: 'lastUsed',
      header: t('table.lastUsed'),
      priority: 3,
      className: 'admin-dt__date',
      cell: (waiter) => formatDate(waiter.lastUsedAt),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'trailing',
      cell: (waiter) => (
        <>
          <span className={`badge ${waiter.isActive ? 'badge--success' : 'badge--neutral'}`}>
            {waiter.isActive ? t('status.active') : t('status.inactive')}
          </span>
          {waiter.anonymizeDueAt && (
            <small className="waiters-due" data-testid="waiter-anonymize-due">
              {t('anonymizeDue', { date: formatDay(waiter.anonymizeDueAt) })}
            </small>
          )}
        </>
      ),
    },
    {
      // Telefon: die Löschfrist als eigene Zeile unter dem Eintrag.
      id: 'anonymizeDue',
      header: t('table.status'),
      mobile: 'meta',
      className: 'admin-dt__phone-only admin-dt__m-line',
      cell: (waiter) =>
        waiter.anonymizeDueAt ? t('anonymizeDue', { date: formatDay(waiter.anonymizeDueAt) }) : null,
    },
  ];

  /* Abrechnen und Bearbeiten stehen als Symbol in der Zeile, der Rest
     (neue PIN, (de)aktivieren, Auskunft, Löschen) im ⋯-Menü. */
  const actions = (waiter: Waiter): RowAction[] => [
    {
      id: 'settle',
      label: t('actions.settle', { name: waiter.name }),
      icon: 'receipt',
      onClick: () => setSettling(waiter),
    },
    {
      id: 'edit',
      label: t('actions.edit', { name: waiter.name }),
      icon: 'edit',
      onClick: () => setFormFor(waiter),
    },
    {
      id: 'resetPin',
      label: t('actions.resetPin', { name: waiter.name }),
      icon: 'refresh',
      hidden: !waiter.isActive,
      disabled: resetPin.isPending,
      onClick: () => handleResetPin(waiter),
    },
    {
      id: 'toggleActive',
      label: waiter.isActive
        ? t('actions.deactivate', { name: waiter.name })
        : t('actions.activate', { name: waiter.name }),
      icon: waiter.isActive ? 'ban' : 'check-circle',
      onClick: () => handleToggleActive(waiter),
    },
    {
      id: 'export',
      label: t('actions.export', { name: waiter.name }),
      icon: 'download',
      disabled: exporting === waiter.id,
      onClick: () => void handleExport(waiter),
    },
    {
      id: 'delete',
      label: t('actions.delete', { name: waiter.name }),
      icon: 'trash',
      danger: true,
      onClick: () => setDeleting(waiter),
    },
  ];

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
      <div data-testid="waiters-table">
        <AdminTable
          caption={t('title')}
          rows={waiters}
          rowKey="id"
          columns={columns}
          actions={actions}
          rowClassName={(waiter) => (waiter.isActive ? undefined : 'admin-dt__row--muted')}
        />
      </div>
    );

  return (
    <>
      <div className="app-card app-card--flat waiters-card">
        {/* Kopf: Anzahl links, der Veranstaltungsfilter (Telefon: im Sheet)
            und die Symbolknöpfe zum Anlegen rechts. */}
        <AdminFilterBar
          className="waiters-filterbar"
          leading={
            <div className="waiters-filterbar__count">
              <p className="admin-list-head__count">{t('count', { count: waiters.length })}</p>
              {limitLabel && (
                <p className="waiters-limit" data-testid="waiter-limit">
                  {limitLabel}
                </p>
              )}
            </div>
          }
          activeCount={eventFilter === 'all' ? 0 : 1}
          onReset={() => setEventFilter('all')}
          actions={
            <>
              <ListAction icon="users" label={t('actions.bulk')} onClick={() => setBulkOpen(true)} />
              <ListAction variant="primary" icon="plus" label={t('actions.create')} onClick={() => setFormFor('new')} />
            </>
          }
        >
          <Select
            label={phone ? t('filter.label') : undefined}
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            aria-label={t('filter.label')}
          >
            <option value="all">{t('filter.all')}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {t('filter.event', { name: event.name })}
              </option>
            ))}
          </Select>
        </AdminFilterBar>
        {body}
      </div>

      <div className="waiters-hint">
        <Icon name="info" size={16} />
        <p>{t('hint')}</p>
      </div>

      <WaiterSettlementsSection
        organizationId={organizationId}
        eventId={eventFilter === 'all' ? null : eventFilter}
        highlight={settled}
        onCloseHighlight={() => setSettled(null)}
      />

      {isAdmin && <WaiterSettingsCard />}

      {settling && (
        <WaiterSettleModal
          organizationId={organizationId}
          waiter={settling}
          waiters={waiters}
          onClose={() => setSettling(null)}
          onSettled={(settlement) => {
            setSettling(null);
            setSettled(settlement);
          }}
        />
      )}

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
