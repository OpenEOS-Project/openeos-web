'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminEvents, useMarkEventInvoiced, useUnmarkEventInvoiced, useWaiveEvent } from '@/hooks/use-admin-events';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import type { AdminEventListItem } from '@/types/admin';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

const statusBadge: Record<string, string> = {
  active: 'badge badge--success',
  inactive: 'badge badge--neutral',
  test: 'badge badge--warning',
};

const statusLabel: Record<string, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  test: 'Test',
};

const billingStatusBadge: Record<string, string> = {
  none: 'badge badge--neutral',
  pending: 'badge badge--warning',
  paid: 'badge badge--success',
  invoice: 'badge badge--info',
  waived: 'badge badge--neutral',
};

const billingStatusLabel: Record<string, string> = {
  none: 'Nicht bestellt',
  pending: 'Ausstehend',
  paid: 'Bezahlt',
  invoice: 'Auf Rechnung',
  waived: 'Erlassen',
};

interface MarkInvoicedModalProps {
  event: AdminEventListItem;
  onClose: () => void;
}

function MarkInvoicedModal({ event, onClose }: MarkInvoicedModalProps) {
  const t = useTranslations();
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
            <div className="modal__title">Als abgerechnet markieren</div>
            <div className="modal__sub">{event.name} — {event.organizationName}</div>
          </div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'color-mix(in oklab, var(--ink) 4%, transparent)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginBottom: 2 }}>Bestellungen</div>
              <div style={{ fontWeight: 600 }}>{event.orderCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginBottom: 2 }}>Umsatz</div>
              <div style={{ fontWeight: 600 }}>{formatCurrency(event.revenueTotal)}</div>
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="invoice-note">Notiz (optional)</label>
            <textarea
              id="invoice-note"
              className="textarea"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. Rechnung 2024-001 erstellt"
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
            {markInvoiced.isPending ? t('common.saving') : 'Als abgerechnet markieren'}
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
          <div className="modal__title">Abrechnung zurücksetzen</div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>
            Die Abrechnungsmarkierung wird entfernt. Das Event gilt dann wieder als nicht abgerechnet.
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
            {unmarkInvoiced.isPending ? t('common.saving') : 'Zurücksetzen'}
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
          <div className="modal__title">Abrechnung erlassen</div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>
            Das Event kann danach ohne Bezahlung oder Rechnung aktiviert werden.
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
            {waiveEvent.isPending ? t('common.saving') : 'Erlassen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminEventsContainer() {
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
            placeholder="Event oder Organisation suchen..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ minWidth: 200, flex: '1 1 200px' }}
          />
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Inaktiv</option>
            <option value="test">Test</option>
          </select>
          <select
            className="select"
            value={invoicedFilter}
            onChange={(e) => { setInvoicedFilter(e.target.value); setPage(1); }}
          >
            <option value="">Alle (Abrechnung)</option>
            <option value="yes">Abgerechnet</option>
            <option value="no">Nicht abgerechnet</option>
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
          title="Keine Events gefunden"
          description="Es gibt keine Events, die den Filterkriterien entsprechen."
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          }
        />
      ) : (
        <div className="app-card app-card--flat">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Organisation</th>
                  <th>Datum</th>
                  <th>Status</th>
                  <th className="text-right">Bestellungen</th>
                  <th className="text-right">Umsatz</th>
                  <th>Bezahlung</th>
                  <th>Abgerechnet</th>
                  <th className="text-right">Aktionen</th>
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
                        <span className="badge badge--neutral">Nein</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {event.invoicedAt ? (
                          <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setUnmarkEvent(event)}>
                            Zurücksetzen
                          </button>
                        ) : (
                          <button className="btn btn--primary" style={{ fontSize: 12 }} onClick={() => setMarkEvent(event)}>
                            Abrechnen
                          </button>
                        )}
                        {(event.billingStatus === 'none' || event.billingStatus === 'pending' || !event.billingStatus) && (
                          <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setWaiveEventTarget(event)}>
                            Erlassen
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
            {meta.total} Events gesamt
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn--ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!meta.hasPrev}
            >
              Zurück
            </button>
            <span style={{ fontSize: 13, padding: '0 8px' }}>
              Seite {page} von {meta.totalPages}
            </span>
            <button
              className="btn btn--ghost"
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={!meta.hasNext}
            >
              Weiter
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
