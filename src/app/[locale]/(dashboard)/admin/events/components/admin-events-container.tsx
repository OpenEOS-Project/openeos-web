'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useAdminEvents, useMarkEventInvoiced, useUnmarkEventInvoiced, useWaiveEvent } from '@/hooks/use-admin-events';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import type { AdminEventListItem } from '@/types/admin';

const statusBadge: Record<string, string> = {
  active: 'badge badge--success',
  inactive: 'badge badge--neutral',
  test: 'badge badge--warning',
};

const billingStatusBadge: Record<string, string> = {
  none: 'badge badge--neutral',
  pending: 'badge badge--warning',
  paid: 'badge badge--success',
  invoice: 'badge badge--info',
  waived: 'badge badge--neutral',
};

type Translator = ReturnType<typeof useTranslations>;

function statusLabels(t: Translator): Record<string, string> {
  return {
    active: t('admin.events.status.active'),
    inactive: t('admin.events.status.inactive'),
    test: t('admin.events.status.test'),
  };
}

function billingStatusLabels(t: Translator): Record<string, string> {
  return {
    none: t('admin.events.billingStatus.none'),
    pending: t('admin.events.billingStatus.pending'),
    paid: t('admin.events.billingStatus.paid'),
    invoice: t('admin.events.billingStatus.invoice'),
    waived: t('admin.events.billingStatus.waived'),
  };
}

interface MarkInvoicedModalProps {
  event: AdminEventListItem;
  onClose: () => void;
}

function MarkInvoicedModal({ event, onClose }: MarkInvoicedModalProps) {
  const t = useTranslations();
  const { formatCurrency } = useLocaleFormat();
  const [note, setNote] = useState('');
  const markInvoiced = useMarkEventInvoiced();

  function handleSubmit() {
    markInvoiced.mutate(
      { id: event.id, note: note || undefined },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <div className="modal__title">{t('admin.events.markInvoiced.title')}</div>
            <div className="modal__sub">{event.name} — {event.organizationName}</div>
          </div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'color-mix(in oklab, var(--ink) 4%, transparent)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginBottom: 2 }}>{t('admin.events.markInvoiced.orders')}</div>
              <div style={{ fontWeight: 600 }}>{event.orderCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginBottom: 2 }}>{t('admin.events.markInvoiced.revenue')}</div>
              <div style={{ fontWeight: 600 }}>{formatCurrency(event.revenueTotal)}</div>
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="invoice-note">{t('admin.events.markInvoiced.note')}</label>
            <textarea
              id="invoice-note"
              className="textarea"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('admin.events.markInvoiced.notePlaceholder')}
            />
          </div>
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={markInvoiced.isPending}
          >
            {markInvoiced.isPending ? t('common.saving') : t('admin.events.markInvoiced.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface UnmarkModalProps {
  event: AdminEventListItem;
  onClose: () => void;
}

function UnmarkInvoicedModal({ event, onClose }: UnmarkModalProps) {
  const t = useTranslations();
  const unmarkInvoiced = useUnmarkEventInvoiced();

  function handleConfirm() {
    unmarkInvoiced.mutate(event.id, { onSuccess: onClose });
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box modal__panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('admin.events.unmark.title')}</div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>
            {t('admin.events.unmark.description')}
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>{event.name} — {event.organizationName}</p>
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn btn--primary"
            style={{ background: 'var(--red, var(--danger))' }}
            onClick={handleConfirm}
            disabled={unmarkInvoiced.isPending}
          >
            {unmarkInvoiced.isPending ? t('common.saving') : t('admin.events.unmark.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface WaiveModalProps {
  event: AdminEventListItem;
  onClose: () => void;
}

function WaiveEventModal({ event, onClose }: WaiveModalProps) {
  const t = useTranslations();
  const waiveEvent = useWaiveEvent();

  function handleConfirm() {
    waiveEvent.mutate(event.id, { onSuccess: onClose });
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box modal__panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('admin.events.waive.title')}</div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>
            {t('admin.events.waive.description')}
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>{event.name} — {event.organizationName}</p>
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn btn--primary"
            onClick={handleConfirm}
            disabled={waiveEvent.isPending}
          >
            {waiveEvent.isPending ? t('common.saving') : t('admin.events.waive.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminEventsContainer() {
  const t = useTranslations('admin.events');
  const tRoot = useTranslations();
  const { formatCurrency, formatDate } = useLocaleFormat();
  const statusLabel = statusLabels(tRoot);
  const billingStatusLabel = billingStatusLabels(tRoot);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [invoicedFilter, setInvoicedFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [markEvent, setMarkEvent] = useState<AdminEventListItem | null>(null);
  const [unmarkEvent, setUnmarkEvent] = useState<AdminEventListItem | null>(null);
  const [waiveEvent, setWaiveEventTarget] = useState<AdminEventListItem | null>(null);

  const invoicedParam =
    invoicedFilter === 'yes' ? true : invoicedFilter === 'no' ? false : undefined;

  const { data, isLoading } = useAdminEvents({
    search: search || undefined,
    status: statusFilter || undefined,
    from: from || undefined,
    to: to || undefined,
    invoiced: invoicedParam,
    page,
    limit: 20,
  });

  const events = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) {
    return <ListLoading />;
  }

  return (
    <>
      {/* Filters */}
      <div className="app-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <input
            type="text"
            className="input"
            placeholder={t('filters.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ minWidth: 200, flex: '1 1 200px' }}
          />
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">{t('filters.allStatuses')}</option>
            <option value="active">{t('status.active')}</option>
            <option value="inactive">{t('status.inactive')}</option>
            <option value="test">{t('status.test')}</option>
          </select>
          <select
            className="select"
            value={invoicedFilter}
            onChange={(e) => { setInvoicedFilter(e.target.value); setPage(1); }}
          >
            <option value="">{t('filters.allInvoiced')}</option>
            <option value="yes">{t('filters.invoiced')}</option>
            <option value="no">{t('filters.notInvoiced')}</option>
          </select>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          />
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      {events.length === 0 ? (
        <ListEmpty
          title={t('empty.title')}
          description={t('empty.description')}
          icon={
            <Icon name="calendar" size={28} />
          }
        />
      ) : (
        <div className="app-card app-card--flat">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.event')}</th>
                  <th>{t('table.organization')}</th>
                  <th>{t('table.date')}</th>
                  <th>{t('table.status')}</th>
                  <th className="text-right">{t('table.orders')}</th>
                  <th className="text-right">{t('table.revenue')}</th>
                  <th>{t('table.payment')}</th>
                  <th>{t('table.invoiced')}</th>
                  <th className="text-right">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td style={{ fontWeight: 600 }}>{event.name}</td>
                    <td>{event.organizationName}</td>
                    <td className="mono">
                      {formatDate(event.startDate)}
                      {event.endDate && event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ''}
                    </td>
                    <td>
                      <span className={statusBadge[event.status] ?? 'badge badge--neutral'}>
                        {statusLabel[event.status] ?? event.status}
                      </span>
                    </td>
                    <td className="mono text-right">{event.orderCount}</td>
                    <td className="mono text-right" style={{ fontWeight: 600 }}>{formatCurrency(event.revenueTotal)}</td>
                    <td>
                      <span className={billingStatusBadge[event.billingStatus ?? 'none'] ?? 'badge badge--neutral'}>
                        {billingStatusLabel[event.billingStatus ?? 'none'] ?? event.billingStatus}
                      </span>
                    </td>
                    <td>
                      {event.invoicedAt ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="badge badge--success">{formatDate(event.invoicedAt)}</span>
                          {event.invoiceNote && (
                            <span style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {event.invoiceNote}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="badge badge--neutral">{tRoot('common.no')}</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {event.invoicedAt ? (
                          <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setUnmarkEvent(event)}>
                            {t('actions.reset')}
                          </button>
                        ) : (
                          <button className="btn btn--primary" style={{ fontSize: 12 }} onClick={() => setMarkEvent(event)}>
                            {t('actions.invoice')}
                          </button>
                        )}
                        {(event.billingStatus === 'none' || event.billingStatus === 'pending' || !event.billingStatus) && (
                          <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setWaiveEventTarget(event)}>
                            {t('actions.waive')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
          <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
            {t('pagination.total', { count: meta.total })}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn--ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!meta.hasPrev}
            >
              {tRoot('common.previous')}
            </button>
            <span style={{ fontSize: 13, padding: '0 8px' }}>
              {t('pagination.page', { page, totalPages: meta.totalPages })}
            </span>
            <button
              className="btn btn--ghost"
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={!meta.hasNext}
            >
              {tRoot('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {markEvent && (
        <MarkInvoicedModal event={markEvent} onClose={() => setMarkEvent(null)} />
      )}
      {unmarkEvent && (
        <UnmarkInvoicedModal event={unmarkEvent} onClose={() => setUnmarkEvent(null)} />
      )}
      {waiveEvent && (
        <WaiveEventModal event={waiveEvent} onClose={() => setWaiveEventTarget(null)} />
      )}
    </>
  );
}
