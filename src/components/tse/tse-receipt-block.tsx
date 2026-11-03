'use client';

import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';

import { isV0QrPayload, tseNoticeKind } from '@/lib/tse';
import type { TseReceiptView } from '@/types/tse';

import '@/styles/tse.css';

interface TseReceiptBlockProps {
  view: TseReceiptView;
  /** QR-Code nach DSFinV-K Anhang I zeigen (Standard: ja). */
  showQr?: boolean;
  /** Kantenlänge des QR-Codes in px. */
  qrSize?: number;
  /** `receipt`: im Bon (Monospace, schmal); `panel`: in der Verwaltung. */
  variant?: 'receipt' | 'panel';
  className?: string;
}

/**
 * TSE-Angaben eines Belegs wie auf dem gedruckten Bon (AEAO zu § 146a
 * Nr. 2.2): Kasse (Client-ID), TSE-Seriennummer und Signatur ungekürzt,
 * Transaktionsnummer, Signaturzähler, Start und Ende in UTC wie von der
 * TSE geliefert, dazu der QR-Code. Ohne Signatur steht nur der
 * Ausfallvermerk da, bei Training der Trainingsvermerk.
 */
export function TseReceiptBlock({
  view,
  showQr = true,
  qrSize = 132,
  variant = 'receipt',
  className,
}: TseReceiptBlockProps) {
  const t = useTranslations('tse.receipt');
  const notice = tseNoticeKind(view);
  const failed = notice === 'failed';
  const qr = !failed && showQr && isV0QrPayload(view.qrCode) ? view.qrCode : null;

  const rows: Array<[string, string | number | null, boolean?]> = failed
    ? [
        [t('bon'), view.bonNumber ?? null],
        [t('client'), view.clientId],
        [t('serial'), view.serialNumber, true],
        [t('start'), view.startTime],
      ]
    : [
        [t('bon'), view.bonNumber ?? null],
        [t('client'), view.clientId],
        [t('serial'), view.serialNumber, true],
        [t('transaction'), view.transactionNumber],
        [t('counter'), view.signatureCounter],
        [t('start'), view.startTime],
        [t('finish'), view.finishTime],
        [t('algorithm'), view.signatureAlgorithm],
        [t('timeFormat'), view.logTimeFormat],
        [t('signature'), view.signatureValue, true],
      ];

  return (
    <div
      className={['tse-block', `tse-block--${variant}`, className].filter(Boolean).join(' ')}
      data-testid="tse-receipt-block"
      data-tse-status={view.status}
    >
      {notice && (
        <p className={`tse-block__notice tse-block__notice--${notice}`} role={failed ? 'alert' : undefined}>
          {t(`notice.${notice}`)}
        </p>
      )}
      <dl className="tse-block__rows">
        {rows
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([label, value, long]) => (
            <div key={label} className={long ? 'tse-block__row tse-block__row--long' : 'tse-block__row'}>
              <dt>{label}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
      </dl>
      {failed && view.errorCode && <p className="tse-block__error">{t('errorCode', { code: view.errorCode })}</p>}
      {qr && (
        <div className="tse-block__qr">
          <QRCodeSVG value={qr} size={qrSize} level="Q" marginSize={2} aria-label={t('qrLabel')} role="img" />
        </div>
      )}
    </div>
  );
}
