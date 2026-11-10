'use client';

import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';

import { PublicLegalFooter } from '@/components/public-legal/public-legal-footer';
import { ReceiptBlocks } from '@/components/receipts/receipt-blocks';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { publicReceiptsApi } from '@/lib/api-client';

/**
 * Digitaler Beleg zum Scannen (QR-Code an der Kasse) bzw. aus der
 * Beleg-Mail: derselbe Inhalt wie der gedruckte Bon, als PDF zum
 * Herunterladen. Ohne Anmeldung, ohne Gästeangaben.
 */
export default function PublicReceiptPage() {
  const { token } = useParams() as { token: string };
  const t = useTranslations('receiptPublic');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { data, error, isLoading } = useQuery({
    queryKey: ['public-receipt', token],
    queryFn: async () => (await publicReceiptsApi.get(token)).data,
    retry: false,
    staleTime: 60_000,
  });

  const until = data
    ? new Date(data.expiresAt).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  const hospitality = data?.receipts.some((r) => r.kind === 'hospitality');

  return (
    <div className="receipt-public">
      <main className="receipt-public__main">
        {isLoading && <p className="receipt-public__state">{t('loading')}</p>}
        {error && (
          <div className="receipt-public__state" role="alert">
            <h1>{t('goneTitle')}</h1>
            <p>{apiErrorMessage(error)}</p>
          </div>
        )}
        {data && (
          <>
            <div className="receipt-public__head">
              <h1>{hospitality ? t('titleHospitality') : t('title')}</h1>
              <a className="btn btn--primary" href={publicReceiptsApi.pdfUrl(token)} download data-testid="receipt-pdf">
                <Download aria-hidden size={16} />
                {t('pdf')}
              </a>
            </div>
            {data.receipts.map((receipt, i) => (
              <article
                key={`${receipt.orderNumber}-${i}`}
                className="receipt-public__paper"
                aria-label={t('receiptLabel', { number: receipt.orderNumber })}
              >
                <ReceiptBlocks blocks={receipt.blocks} />
              </article>
            ))}
            <p className="receipt-public__fine">{t('validUntil', { date: until })}</p>
          </>
        )}
      </main>
      <PublicLegalFooter legal={data?.legal} />
    </div>
  );
}
