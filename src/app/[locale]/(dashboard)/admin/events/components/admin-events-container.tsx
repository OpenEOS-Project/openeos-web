'use client';

import { useState } from 'react';
import { Calendar, CheckCircle, XCircle } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { useAdminEvents, useMarkEventInvoiced, useUnmarkEventInvoiced } from '@/hooks/use-admin-events';
import type { AdminEventListItem } from '@/types/admin';
import type { BadgeColors } from '@/components/ui/badges/badge-types';

const statusColors: Record<string, BadgeColors> = {
  active: 'success',
  inactive: 'gray',
  test: 'warning',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

interface InvoiceModalProps {
  event: AdminEventListItem;
  onClose: () => void;
}

function MarkInvoicedModal({ event, onClose }: InvoiceModalProps) {
  const [note, setNote] = useState('');
  const markInvoiced = useMarkEventInvoiced();

  function handleSubmit() {
    markInvoiced.mutate(
      { id: event.id, note: note || undefined },
      { onSuccess: onClose },
    );
  }

  return (
    <DialogModal
      isOpen
      onClose={onClose}
      title="Als abgerechnet markieren"
      description={`Event: ${event.name} (${event.organizationName})`}
      size="md"
    >
      <div className="px-6 py-4 space-y-4">
        <div>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary p-4 text-sm">
            <div>
              <p className="text-tertiary">Bestellungen</p>
              <p className="font-semibold text-primary">{event.orderCount}</p>
            </div>
            <div>
              <p className="text-tertiary">Umsatz</p>
              <p className="font-semibold text-primary">{formatCurrency(event.revenueTotal)}</p>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="invoice-note" className="block text-sm font-medium text-secondary mb-1">
            Notiz (optional)
          </label>
          <textarea
            id="invoice-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="z.B. Rechnung 2024-001 erstellt"
            className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-quaternary focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
        <Button type="button" color="secondary" onClick={onClose}>
          Abbrechen
        </Button>
        <Button
          color="primary"
          onClick={handleSubmit}
          disabled={markInvoiced.isPending}
        >
          {markInvoiced.isPending ? '...' : 'Als abgerechnet markieren'}
        </Button>
      </div>
    </DialogModal>
  );
}

interface UnmarkModalProps {
  event: AdminEventListItem;
  onClose: () => void;
}

function UnmarkInvoicedModal({ event, onClose }: UnmarkModalProps) {
  const unmarkInvoiced = useUnmarkEventInvoiced();

  function handleConfirm() {
    unmarkInvoiced.mutate(event.id, { onSuccess: onClose });
  }

  return (
    <DialogModal
      isOpen
      onClose={onClose}
      title="Abrechnung zurücksetzen"
      description={`Event: ${event.name} (${event.organizationName})`}
      size="sm"
    >
      <div className="px-6 py-4">
        <p className="text-sm text-secondary">
          Die Abrechnungsmarkierung wird entfernt. Das Event gilt dann wieder als nicht abgerechnet.
        </p>
      </div>

      <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
        <Button type="button" color="secondary" onClick={onClose}>
          Abbrechen
        </Button>
        <Button
          color="primary-destructive"
          onClick={handleConfirm}
          disabled={unmarkInvoiced.isPending}
        >
          {unmarkInvoiced.isPending ? '...' : 'Zurücksetzen'}
        </Button>
      </div>
    </DialogModal>
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
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Event oder Organisation suchen..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-quaternary focus:outline-none focus:ring-2 focus:ring-brand-primary min-w-[200px]"
        />

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="inactive">Inaktiv</option>
          <option value="test">Test</option>
        </select>

        <select
          value={invoicedFilter}
          onChange={(e) => { setInvoicedFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="">Alle (Abrechnung)</option>
          <option value="yes">Abgerechnet</option>
          <option value="no">Nicht abgerechnet</option>
        </select>

        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          placeholder="Von"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); }}
          className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          placeholder="Bis"
        />
      </div>

      {/* Table */}
      {events.length === 0 ? (
        <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
          <EmptyState
            icon="settings"
            title="Keine Events gefunden"
            description="Es gibt keine Events, die den Filterkriterien entsprechen."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-secondary">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">Event</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">Organisation</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">Datum</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-tertiary">Bestellungen</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-tertiary">Umsatz</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">Abgerechnet</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-tertiary">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary bg-primary">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-secondary/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-tertiary">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <p className="font-medium text-primary text-sm">{event.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-secondary">{event.organizationName}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-secondary whitespace-nowrap">
                      {formatDate(event.startDate)}
                      {event.endDate && event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={statusColors[event.status] ?? 'gray'} size="sm">
                      {event.status === 'active' ? 'Aktiv' : event.status === 'test' ? 'Test' : 'Inaktiv'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-primary">{event.orderCount}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-primary">{formatCurrency(event.revenueTotal)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {event.invoicedAt ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-success-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-success-primary">{formatDate(event.invoicedAt)}</p>
                          {event.invoiceNote && (
                            <p className="text-xs text-tertiary truncate max-w-[140px]">{event.invoiceNote}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-tertiary">
                        <XCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs">Nein</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {event.invoicedAt ? (
                      <Button
                        size="sm"
                        color="secondary"
                        onClick={() => setUnmarkEvent(event)}
                      >
                        Zurücksetzen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setMarkEvent(event)}
                      >
                        Abrechnen
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-tertiary">
            {meta.total} Events gesamt
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              color="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!meta.hasPrev}
            >
              Zurück
            </Button>
            <span className="flex items-center px-3 text-sm text-secondary">
              Seite {page} von {meta.totalPages}
            </span>
            <Button
              size="sm"
              color="secondary"
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={!meta.hasNext}
            >
              Weiter
            </Button>
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
    </>
  );
}
