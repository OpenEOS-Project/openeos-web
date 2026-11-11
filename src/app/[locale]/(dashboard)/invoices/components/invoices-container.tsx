'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { type DataColumn, type RowAction } from '@openeos/ui';
import { CreditCard, ExternalLink, FileText } from 'lucide-react';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { useInvoices } from '@/hooks/use-invoices';
import { billingApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency } from '@/utils/format';
import { invoiceDisplayStatus, isInvoicePayable } from '@/utils/stripe-invoice';
import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';
import { AdminTable, CellMain, CellNone, CellText } from '@/components/shared/admin-table';
import { toast } from '@/components/shared/toast';
import type { OrganizationInvoice } from '@/types/billing';

import '@/styles/admin-table-wave2.css';

/* Stripes Statuswerte auf die Abzeichen der Anwendung abgebildet. Ein
   unbekannter Status faellt auf das neutrale Abzeichen zurueck, statt die
   Zeile ohne Kennzeichnung zu lassen. */
const STATUS_BADGE: Record<string, string> = {
  paid: 'badge badge--success',
  open: 'badge badge--warning',
  overdue: 'badge badge--error',
  draft: 'badge',
  uncollectible: 'badge badge--error',
  void: 'badge',
  // Stornorechnungen (Stripe-Gutschriften) sind ausgestellt oder ungültig.
  issued: 'badge badge--neutral',
};

export function InvoicesContainer() {
  const t = useTranslations('invoices');
  const tErrors = useTranslations('errors');
  const locale = useIntlLocale();

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: invoices, isLoading, isError, refetch } = useInvoices(organizationId);
  const [downloading, setDownloading] = useState<string | null>(null);

  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const handleDownload = async (invoice: OrganizationInvoice) => {
    setDownloading(invoice.id);
    try {
      const blob = await billingApi.invoicePdf(organizationId, invoice.id);
      /* Ueber ein Objekt-URL und einen unsichtbaren Link: das PDF kommt mit
         dem Anmeldetoken herein, ein direkter Aufruf der Adresse waere
         anonym und liefe in ein 401. */
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.number ?? invoice.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('downloadFailed'));
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) return <ListLoading />;
  if (isError) return <ListError message={tErrors('generic')} onRetry={() => refetch()} />;

  if (!invoices || invoices.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        /* Online bezahlt oder auf Rechnung über Stripe: beides landet hier.
           Nur Altfälle von Hand gestellter Rechnungen stehen nicht in der
           Liste — der Text sagt das, damit es nicht wie ein Fehler aussieht. */
        description={t('empty.description')}
        icon={
          <FileText size={28} />
        }
      />
    );
  }

  const description = (invoice: OrganizationInvoice) =>
    invoice.kind === 'credit_note' && invoice.relatedInvoiceNumber
      ? t('creditNote.description', { number: invoice.relatedInvoiceNumber })
      : invoice.description;

  const columns: DataColumn<OrganizationInvoice>[] = [
    {
      id: 'number',
      header: t('table.number'),
      mobile: 'title',
      className: 'invoices-list__number',
      cell: (invoice) => (
        <CellMain
          title={invoice.number ?? <span className="admin-cell-text--muted">{t('noNumber')}</span>}
          titleText={invoice.number ?? undefined}
          extra={
            invoice.kind === 'credit_note' ? (
              <span className="badge badge--warning">{t('creditNote.badge')}</span>
            ) : undefined
          }
        />
      ),
    },
    {
      id: 'date',
      header: t('table.date'),
      mobile: 'meta',
      className: 'admin-dt__date',
      cell: (invoice) => (invoice.issuedAt ? dateFormat.format(new Date(invoice.issuedAt)) : <CellNone />),
    },
    {
      id: 'description',
      header: t('table.description'),
      mobile: 'meta',
      cell: (invoice) => {
        const text = description(invoice);
        return text ? (
          <CellText title={text}>{text}</CellText>
        ) : (
          <CellNone />
        );
      },
    },
    {
      id: 'amount',
      header: t('table.amount'),
      num: true,
      mobile: 'trailing',
      // Eine Stornorechnung hebt einen Betrag auf — als negativer Wert lesbar.
      cell: (invoice) => formatCurrency(invoice.kind === 'credit_note' ? -invoice.total : invoice.total, locale),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (invoice) => {
        const status = invoiceDisplayStatus(invoice.status, invoice.dueAt);
        return (
          <span className="invoices-list__status">
            <span className={STATUS_BADGE[status] ?? 'badge'} data-testid="invoice-status">
              {t.has(`status.${status}`) ? t(`status.${status}`) : status}
            </span>
            {/* Nur Rechnungen mit Zahlungsziel (auf Rechnung) haben eines;
                bezahlte und stornierte brauchen es nicht mehr. */}
            {invoice.dueAt && isInvoicePayable(status) && (
              <span className="invoices-list__due">
                {t('dueOn', { date: dateFormat.format(new Date(invoice.dueAt)) })}
              </span>
            )}
          </span>
        );
      },
    },
  ];

  /* Stripe-Seiten öffnen in einem neuen Tab. RowAction kennt kein target:
     der Link behält seine Adresse (Mittelklick, Kopieren), der Klick
     öffnet den Tab selbst. */
  const openInNewTab = (url: string) => (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const actions = (invoice: OrganizationInvoice): RowAction[] => {
    const status = invoiceDisplayStatus(invoice.status, invoice.dueAt);
    const payable = invoice.kind === 'invoice' && isInvoicePayable(status) && !!invoice.hostedUrl;
    const hostedUrl = invoice.hostedUrl ?? '';
    return [
      {
        id: 'pay',
        label: t('pay'),
        icon: <CreditCard />,
        primary: true,
        hidden: !payable,
        href: hostedUrl,
        onClick: openInNewTab(hostedUrl),
      },
      {
        id: 'download',
        label: t('downloadPdf'),
        icon: 'download',
        hidden: !invoice.hasPdf,
        disabled: downloading === invoice.id,
        onClick: () => void handleDownload(invoice),
      },
      {
        id: 'stripe',
        label: t('viewAtStripe'),
        icon: <ExternalLink />,
        hidden: !invoice.hostedUrl || payable,
        href: hostedUrl,
        onClick: openInNewTab(hostedUrl),
      },
    ];
  };

  return (
    <div className="app-card app-card--flat invoices-card">
      <AdminTable caption={t('title')} rows={invoices} rowKey="id" columns={columns} actions={actions} />

      <p className="invoices-list__note">{t('issuerNote')}</p>
    </div>
  );
}
