'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

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
  uncollectible: 'badge badge--danger',
  void: 'badge',
};

export function InvoicesContainer() {
  const t = useTranslations('invoices');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const currencyLocale = locale === 'de' ? 'de-DE' : 'en-US';

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: invoices, isLoading, isError, refetch } = useInvoices(organizationId);
  const [downloading, setDownloading] = useState<string | null>(null);

  const dateFormat = new Intl.DateTimeFormat(currencyLocale, {
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
            <path d="M8 13h8" />
            <path d="M8 17h5" />
          </svg>
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
                  {formatCurrency(invoice.total, currencyLocale)}
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
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
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
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
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
