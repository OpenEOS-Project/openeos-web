'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { ExternalLink, FileText } from 'lucide-react';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { useInvoices } from '@/hooks/use-invoices';
import { billingApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency } from '@/utils/format';
import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';
import { toast } from '@/components/shared/toast';
import type { OrganizationInvoice } from '@/types/billing';

/* Stripes Statuswerte auf die Abzeichen der Anwendung abgebildet. Ein
   unbekannter Status faellt auf das neutrale Abzeichen zurueck, statt die
   Zeile ohne Kennzeichnung zu lassen. */
const STATUS_BADGE: Record<string, string> = {
  paid: 'badge badge--success',
  open: 'badge badge--warning',
  draft: 'badge',
  uncollectible: 'badge badge--error',
  void: 'badge',
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
        /* Der Text nennt beide Wege: wer auf Rechnung zahlt, bekommt seine
           Belege per E-Mail und wird hier dauerhaft nichts sehen. Ohne den
           Zusatz läse sich die leere Liste wie ein Fehler. */
        description={t('empty.description')}
        icon={
          <FileText size={28} />
        }
      />
    );
  }

  return (
    <div className="app-card">
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.number')}</th>
              <th>{t('table.date')}</th>
              <th>{t('table.description')}</th>
              <th style={{ textAlign: 'right' }}>{t('table.amount')}</th>
              <th>{t('table.status')}</th>
              <th style={{ width: 160 }}>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="mono">
                  {invoice.number ?? (
                    <span style={{ opacity: 0.5 }}>{t('noNumber')}</span>
                  )}
                </td>
                <td className="mono">
                  {invoice.issuedAt ? dateFormat.format(new Date(invoice.issuedAt)) : '–'}
                </td>
                <td>{invoice.description ?? '–'}</td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {formatCurrency(invoice.total, locale)}
                </td>
                <td>
                  <span className={STATUS_BADGE[invoice.status] ?? 'badge'}>
                    {t.has(`status.${invoice.status}`) ? t(`status.${invoice.status}`) : invoice.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {invoice.hasPdf && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => handleDownload(invoice)}
                        disabled={downloading === invoice.id}
                      >
                        <Icon name="download" size={15} />
                        {t('download')}
                      </button>
                    )}
                    {invoice.hostedUrl && (
                      <a
                        className="btn btn--ghost btn--sm"
                        href={invoice.hostedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('viewAtStripe')}
                        title={t('viewAtStripe')}
                        style={{ padding: 6, minWidth: 0 }}
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ margin: '12px 16px 0', fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
        {t('issuerNote')}
      </p>
    </div>
  );
}
