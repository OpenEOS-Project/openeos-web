'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Icon,
  Input,
  SearchInput,
  Select,
  useMediaQuery,
  type DataColumn,
  type RowAction,
} from '@openeos/ui';
import { BadgePercent, FileDown, MailCheck, Send } from 'lucide-react';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import {
  useAdminEvents,
  useMarkEventInvoiced,
  useMarkEventInvoicePaid,
  useResendEventInvoice,
  useUnmarkEventInvoiced,
  useWaiveEvent,
  useMoveEventDates,
} from '@/hooks/use-admin-events';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ListLoading } from '@/components/shared/list-states';
import {
  AdminFilterBar,
  AdminPager,
  AdminTable,
  CellMain,
  PHONE_QUERY,
} from '@/components/shared/admin-table';
import { toast } from '@/components/shared/toast';
import { adminApi } from '@/lib/api-client';
import type { AdminEventListItem } from '@/types/admin';
import { ApiException } from '@/types/api';
import type { PurchaseMasterDataField } from '@/types/billing';
import { parseMissingParam } from '@/utils/purchase-master-data';
import { invoiceDisplayStatus, isInvoicePayable } from '@/utils/stripe-invoice';
import { CancelBillingModal } from './cancel-billing-modal';
import { EventPhaseBadge, EventPhaseHint } from '@/components/shared/event-phase';
import { toDayKey, toIsoAtMidnight } from '@/lib/event-schedule';
import type { EventStatus } from '@/types/event';
import '@/styles/admin-table-wave4.css';

const PAGE_LIMIT = 20;

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

/* Zahlungsstand einer Stripe-Rechnung (auf Rechnung). */
const invoiceStatusBadge: Record<string, string> = {
  open: 'badge badge--warning',
  overdue: 'badge badge--error',
  paid: 'badge badge--success',
  void: 'badge badge--neutral',
  uncollectible: 'badge badge--error',
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

/** Auf Rechnung über Stripe: Zahlungsstand, Nummer (Link zur Rechnungsseite) und Fälligkeit. */
function StripeInvoiceCell({ event }: { event: AdminEventListItem }) {
  const t = useTranslations('admin.events');
  const { formatDate } = useLocaleFormat();
  const status = invoiceDisplayStatus(event.invoiceStatus ?? 'open', event.invoiceDueAt);
  const label = event.invoiceNumber ?? event.stripeInvoiceId;
  return (
    /* Telefon: nur das Badge in Zeile 2 (wave4-stack), die Zusatzzeilen fallen weg. */
    <span className="wave4-stack" data-testid="admin-event-invoice">
      <span className={invoiceStatusBadge[status] ?? 'badge badge--neutral'}>
        {t.has(`invoiceStatus.${status}`) ? t(`invoiceStatus.${status}`) : status}
      </span>
      <span className="wave4-stack__line mono">
        {event.invoiceHostedUrl ? (
          <a href={event.invoiceHostedUrl} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ) : (
          label
        )}
      </span>
      {event.invoiceDueAt && isInvoicePayable(status) && (
        <span className="wave4-stack__line">{t('invoiceDue', { date: formatDate(event.invoiceDueAt) })}</span>
      )}
      {status === 'paid' && event.invoicePaidAt && (
        <span className="wave4-stack__line">{t('invoicePaid', { date: formatDate(event.invoicePaidAt) })}</span>
      )}
    </span>
  );
}

/** Rechnung als außerhalb von Stripe bezahlt verbuchen — mit Rückfrage, weil es Stripe schreibt. */
function MarkInvoicePaidModal({ event, onClose }: { event: AdminEventListItem; onClose: () => void }) {
  const t = useTranslations();
  const { formatCurrency } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const markPaid = useMarkEventInvoicePaid();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    markPaid.mutate(event.id, {
      onSuccess: () => {
        toast.success(t('admin.events.toasts.invoiceMarkedPaid'));
        onClose();
      },
      onError: (err) => setError(apiErrorMessage(err, t('errors.generic'))),
    });
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box modal__panel--sm" data-testid="mark-invoice-paid-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('admin.events.markInvoicePaid.title')}</div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>
            {t('admin.events.markInvoicePaid.description')}
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>
            {event.name} — {event.organizationName}
            {event.invoiceNumber ? ` · ${event.invoiceNumber}` : ''}
            {typeof event.priceCharged === 'number' ? ` · ${formatCurrency(event.priceCharged)}` : ''}
          </p>
          {error && (
            <p role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginTop: 8 }}>{error}</p>
          )}
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn btn--primary"
            onClick={handleConfirm}
            disabled={markPaid.isPending}
            data-testid="mark-invoice-paid-submit"
          >
            {markPaid.isPending ? t('common.saving') : t('admin.events.markInvoicePaid.submit')}
          </button>
        </div>
      </div>
    </div>
  );
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

/**
 * Support: eine Veranstaltung verschieben, deren Verkauf schon begonnen hat
 * (sonst gesperrt). Grund Pflicht, protokolliert; die bezahlten Tage gelten
 * weiter. Liegt der Verkaufsstart danach wieder in der Zukunft, ist sie
 * wieder „Geplant“.
 */
function MoveDatesModal({ event, onClose }: { event: AdminEventListItem; onClose: () => void }) {
  const t = useTranslations();
  const apiErrorMessage = useApiErrorMessage();
  const moveDates = useMoveEventDates();
  const [start, setStart] = useState(event.startDate ? toDayKey(event.startDate) : '');
  const [end, setEnd] = useState(
    event.endDate ? toDayKey(event.endDate) : event.startDate ? toDayKey(event.startDate) : '',
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    moveDates.mutate(
      {
        id: event.id,
        startDate: start ? toIsoAtMidnight(start) : undefined,
        endDate: toIsoAtMidnight(end || start),
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t('admin.events.moveDates.success'));
          onClose();
        },
        onError: (err) => setError(apiErrorMessage(err, t('errors.generic'))),
      },
    );
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box modal__panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('admin.events.moveDates.title')}</div>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 65%, transparent)', margin: 0 }}>
            {t('admin.events.moveDates.description')}
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
            {event.name} — {event.organizationName}
          </p>
          <div className="field-row">
            <label className="auth-field">
              <span>{t('events.form.startDate')}</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="auth-field">
              <span>{t('events.form.endDate')}</span>
              <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <label className="auth-field">
            <span>
              {t('admin.events.moveDates.reasonLabel')} <span className="auth-field__req">*</span>
            </span>
            <input
              className="input"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('admin.events.moveDates.reasonPlaceholder')}
              data-testid="move-dates-reason"
            />
          </label>
          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </p>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn btn--primary"
            onClick={handleConfirm}
            disabled={moveDates.isPending || !start || !reason.trim()}
          >
            {moveDates.isPending ? t('common.saving') : t('admin.events.moveDates.submit')}
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
  const apiErrorMessage = useApiErrorMessage();
  const waiveEvent = useWaiveEvent();
  // Pflichtangaben fehlen (400 PURCHASE_MASTER_DATA_REQUIRED): nur mit Grund erlassen.
  const [missing, setMissing] = useState<PurchaseMasterDataField[] | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    waiveEvent.mutate(
      missing ? { id: event.id, overrideMasterData: true, overrideReason: reason.trim() } : event.id,
      {
        onSuccess: onClose,
        onError: (err) => {
          if (err instanceof ApiException && err.code === 'PURCHASE_MASTER_DATA_REQUIRED') {
            setMissing(parseMissingParam(err.params?.missing));
            return;
          }
          setError(apiErrorMessage(err, t('errors.generic')));
        },
      }
    );
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
          {missing && (
            <div
              role="alert"
              data-testid="waive-master-data-missing"
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'color-mix(in oklab, var(--danger) 8%, var(--paper))',
                fontSize: 13,
                color: 'var(--ink)',
              }}
            >
              <b>{t('admin.events.waive.missingTitle')}</b>
              <div>
                {missing.map((field) => t(`admin.events.waive.fields.${field}`)).join(' · ')}
              </div>
              <label className="auth-field" style={{ marginTop: 10 }}>
                <span>
                  {t('admin.events.waive.reasonLabel')} <span className="auth-field__req">*</span>
                </span>
                <input
                  className="input"
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('admin.events.waive.reasonPlaceholder')}
                  data-testid="waive-override-reason"
                />
              </label>
            </div>
          )}
          {error && (
            <p role="alert" style={{ marginTop: 8, fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </p>
          )}
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn btn--primary"
            onClick={handleConfirm}
            disabled={waiveEvent.isPending || (!!missing && !reason.trim())}
          >
            {waiveEvent.isPending
              ? t('common.saving')
              : missing
                ? t('admin.events.waive.submitOverride')
                : t('admin.events.waive.submit')}
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
  const apiErrorMessage = useApiErrorMessage();
  const phone = useMediaQuery(PHONE_QUERY);
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
  const [moveDatesEvent, setMoveDatesEvent] = useState<AdminEventListItem | null>(null);
  const [cancelBillingEvent, setCancelBillingEvent] = useState<AdminEventListItem | null>(null);
  const [markPaidEvent, setMarkPaidEvent] = useState<AdminEventListItem | null>(null);

  // Stripe-Rechnung: erneut senden bzw. PDF laden (Wartezustand je Zeile).
  const resend = useResendEventInvoice();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const invoicedParam =
    invoicedFilter === 'yes' ? true : invoicedFilter === 'no' ? false : undefined;

  const { data, isLoading, isFetching, isPlaceholderData } = useAdminEvents({
    search: search || undefined,
    status: statusFilter || undefined,
    from: from || undefined,
    to: to || undefined,
    invoiced: invoicedParam,
    page,
    limit: PAGE_LIMIT,
  });

  const events = data?.data ?? [];
  const meta = data?.meta;

  // Jede Filteränderung beginnt wieder auf Seite 1.
  const updateFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  const activeFilters = [statusFilter, invoicedFilter, from, to].filter(Boolean).length;
  const resetFilters = () => {
    setStatusFilter('');
    setInvoicedFilter('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const handleResend = (event: AdminEventListItem) => {
    resend.mutate(event.id, {
      onSuccess: () => toast.success(t('toasts.invoiceResent')),
      onError: (err) => toast.error(apiErrorMessage(err, tRoot('errors.generic'))),
    });
  };

  const handlePdf = async (event: AdminEventListItem) => {
    setDownloadingId(event.id);
    try {
      const blob = await adminApi.eventInvoicePdf(event.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.invoiceNumber ?? event.stripeInvoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('toasts.downloadFailed'));
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return <ListLoading />;
  }

  const formatRange = (event: AdminEventListItem) =>
    `${formatDate(event.startDate)}${event.endDate && event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ''}`;

  const columns: DataColumn<AdminEventListItem>[] = [
    {
      id: 'event',
      header: t('table.event'),
      mobile: 'title',
      cell: (event) => (
        <CellMain title={event.name} titleText={event.name} sub={event.organizationName} subText={event.organizationName} />
      ),
    },
    {
      // Telefon: die Organisation vorn in Zeile 2 (Desktop: unter dem Namen).
      id: 'organization',
      header: t('table.organization'),
      mobile: 'meta',
      className: 'admin-dt__phone-only',
      cell: (event) => event.organizationName,
    },
    {
      id: 'date',
      header: t('table.date'),
      priority: 2,
      className: 'wave4-date',
      cell: (event) => formatRange(event),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (event) =>
        event.phase ? (
          <span className="wave4-stack">
            <EventPhaseBadge event={{ ...event, status: event.status as EventStatus }} />
            <EventPhaseHint
              event={{ ...event, status: event.status as EventStatus }}
              className="wave4-stack__line admin-events__hint"
            />
          </span>
        ) : (
          <span className={statusBadge[event.status] ?? 'badge badge--neutral'}>
            {statusLabel[event.status] ?? event.status}
          </span>
        ),
    },
    {
      id: 'orders',
      header: t('table.orders'),
      num: true,
      priority: 3,
      cell: (event) => event.orderCount,
    },
    {
      id: 'revenue',
      header: t('table.revenue'),
      num: true,
      mobile: 'trailing',
      className: 'admin-events__revenue',
      cell: (event) => formatCurrency(event.revenueTotal),
    },
    {
      id: 'payment',
      header: t('table.payment'),
      mobile: 'meta',
      cell: (event) => (
        <span className={billingStatusBadge[event.billingStatus ?? 'none'] ?? 'badge badge--neutral'}>
          {billingStatusLabel[event.billingStatus ?? 'none'] ?? event.billingStatus}
        </span>
      ),
    },
    {
      id: 'invoiced',
      header: t('table.invoiced'),
      mobile: 'meta',
      cell: (event) =>
        event.stripeInvoiceId ? (
          /* Auf Rechnung über Stripe: Nummer, Zahlungsstand und
             Fälligkeit kommen von Stripe, nicht aus einem Vermerk. */
          <StripeInvoiceCell event={event} />
        ) : event.invoicedAt ? (
          <span className="wave4-stack">
            <span className="badge badge--success">{formatDate(event.invoicedAt)}</span>
            {/* Altfall: auf Rechnung, aber die Rechnung wurde außerhalb
                von OpenEOS gestellt und hier nur vermerkt. */}
            {event.billingStatus === 'invoice' && (
              <span className="wave4-stack__line" data-testid="admin-event-manual-invoice">{t('manualInvoice')}</span>
            )}
            {event.invoiceNote && (
              <span className="wave4-stack__line admin-events__note" title={event.invoiceNote}>
                {event.invoiceNote}
              </span>
            )}
          </span>
        ) : (
          <span className="badge badge--neutral">{tRoot('common.no')}</span>
        ),
    },
  ];

  /* Je Zeile zuerst, was zur Abrechnung ansteht (Stripe-Rechnung: PDF,
     erneut senden, als bezahlt markieren; sonst abrechnen bzw.
     zurücksetzen), dann Erlassen und Verschieben; Storno/Erstattung zuletzt. */
  const actions = (event: AdminEventListItem): RowAction[] => {
    const stripe = !!event.stripeInvoiceId;
    const invoiceOpen = stripe && isInvoicePayable(invoiceDisplayStatus(event.invoiceStatus ?? 'open', event.invoiceDueAt));
    return [
      {
        id: 'invoicePdf',
        label: t('actions.invoicePdf'),
        icon: <FileDown />,
        hidden: !stripe || !event.invoiceHasPdf,
        disabled: downloadingId === event.id,
        onClick: () => void handlePdf(event),
      },
      {
        id: 'resendInvoice',
        label: t('actions.resendInvoice'),
        icon: <Send />,
        hidden: !invoiceOpen,
        disabled: resend.isPending && resend.variables === event.id,
        onClick: () => handleResend(event),
      },
      {
        id: 'markInvoicePaid',
        label: t('actions.markInvoicePaid'),
        icon: <MailCheck />,
        hidden: !invoiceOpen,
        onClick: () => setMarkPaidEvent(event),
      },
      {
        id: 'invoice',
        label: t('actions.invoice'),
        icon: 'receipt',
        primary: true,
        hidden: stripe || !!event.invoicedAt,
        onClick: () => setMarkEvent(event),
      },
      {
        id: 'reset',
        label: t('actions.reset'),
        icon: 'undo',
        hidden: stripe || !event.invoicedAt,
        onClick: () => setUnmarkEvent(event),
      },
      {
        id: 'waive',
        label: t('actions.waive'),
        icon: <BadgePercent />,
        hidden: !(event.billingStatus === 'none' || event.billingStatus === 'pending' || !event.billingStatus),
        onClick: () => setWaiveEventTarget(event),
      },
      {
        id: 'moveDates',
        label: t('actions.moveDates'),
        icon: 'calendar',
        hidden: !event.phaseDetails?.datesLocked,
        onClick: () => setMoveDatesEvent(event),
      },
      {
        id: 'cancelBilling',
        label: t('actions.cancelBilling'),
        icon: 'ban',
        danger: true,
        hidden: !(event.billingStatus === 'paid' || event.billingStatus === 'invoice'),
        onClick: () => setCancelBillingEvent(event),
      },
    ];
  };

  return (
    <>
      <div className="app-card app-card--flat">
        {/* Suche immer sichtbar, die übrigen Filter auf dem Telefon im Sheet. */}
        <AdminFilterBar
          leading={
            <SearchInput
              className="admin-events__search"
              icon={<Icon name="search" />}
              value={search}
              onChange={(e) => updateFilter(setSearch)(e.target.value)}
              placeholder={t('filters.searchPlaceholder')}
              aria-label={t('filters.searchPlaceholder')}
            />
          }
          activeCount={activeFilters}
          onReset={resetFilters}
          actions={
            meta ? <span className="admin-events__count">{t('pagination.total', { count: meta.total })}</span> : undefined
          }
        >
          <Select
            label={phone ? t('table.status') : undefined}
            value={statusFilter}
            onChange={(e) => updateFilter(setStatusFilter)(e.target.value)}
            aria-label={t('table.status')}
          >
            <option value="">{t('filters.allStatuses')}</option>
            <option value="active">{t('status.active')}</option>
            <option value="inactive">{t('status.inactive')}</option>
            <option value="test">{t('status.test')}</option>
          </Select>
          <Select
            label={phone ? t('table.invoiced') : undefined}
            value={invoicedFilter}
            onChange={(e) => updateFilter(setInvoicedFilter)(e.target.value)}
            aria-label={t('table.invoiced')}
          >
            <option value="">{t('filters.allInvoiced')}</option>
            <option value="yes">{t('filters.invoiced')}</option>
            <option value="no">{t('filters.notInvoiced')}</option>
          </Select>
          <Input
            label={phone ? tRoot('orders.filters.dateFrom') : undefined}
            type="date"
            value={from}
            onChange={(e) => updateFilter(setFrom)(e.target.value)}
            aria-label={tRoot('orders.filters.dateFrom')}
            title={tRoot('orders.filters.dateFrom')}
          />
          <Input
            label={phone ? tRoot('orders.filters.dateTo') : undefined}
            type="date"
            value={to}
            onChange={(e) => updateFilter(setTo)(e.target.value)}
            aria-label={tRoot('orders.filters.dateTo')}
            title={tRoot('orders.filters.dateTo')}
          />
        </AdminFilterBar>

        <AdminTable
          caption={t('title')}
          rows={events}
          rowKey="id"
          columns={columns}
          actions={actions}
          loading={isPlaceholderData && isFetching}
          empty={
            <div className="empty-state">
              <div className="empty-state__icon">
                <Icon name="calendar" size={28} />
              </div>
              <h3 className="empty-state__title">{t('empty.title')}</h3>
              <p className="empty-state__sub">{t('empty.description')}</p>
            </div>
          }
          footer={
            meta && meta.totalPages > 1 ? (
              <AdminPager page={page} pageSize={PAGE_LIMIT} total={meta.total} onChange={(p) => setPage(p)} />
            ) : undefined
          }
        />
      </div>

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
      {moveDatesEvent && (
        <MoveDatesModal event={moveDatesEvent} onClose={() => setMoveDatesEvent(null)} />
      )}

      {cancelBillingEvent && (
        <CancelBillingModal event={cancelBillingEvent} onClose={() => setCancelBillingEvent(null)} />
      )}
      {markPaidEvent && (
        <MarkInvoicePaidModal event={markPaidEvent} onClose={() => setMarkPaidEvent(null)} />
      )}
    </>
  );
}
