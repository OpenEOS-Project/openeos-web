'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon, Receipt, type ReceiptLine } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import { TseReceiptBlock } from '@/components/tse/tse-receipt-block';
import type { TseReceiptView } from '@/types/tse';
import { doneSheetAutoCloses, receiptAvailable } from '@/lib/receipt';
import { PosSheet } from './pos-sheet';
import { ReceiptHandout, type HandoutView } from './receipt-handout';

export interface DoneInfo {
  /** Bestellung(en), auf die sich der Bon bezieht. */
  orderIds: string[];
  orderNumber: string | null;
  /** Kopf bei mehreren Bestellungen, z. B. „Tisch A05 · 3 Bestellungen“. */
  heading?: string | null;
  amount: number;
  /** `tokens`: nur mit Wertmarken bezahlt. */
  method: 'cash' | 'card' | 'sumup' | 'free' | 'tokens';
  change: number;
  /** Wert der angenommenen Wertmarken (Euro). */
  tokenValue?: number;
  tip: number;
  lines: ReceiptLine[];
  pfand: number;
  discount: number;
  time: string;
  /** Kassenbelege der Cloud-TSE (signiert, Training oder ausgefallen); leer ohne TSE. */
  tse?: TseReceiptView[];
}

interface DoneSheetProps {
  info: DoneInfo | null;
  title: string;
  eventName: string | null;
  deviceName: string;
  isTest: boolean;
  /** Bondrucker vorhanden? Ohne keinen Druckknopf. */
  canPrint: boolean;
  /** Der Server druckt den Bon schon beim Bezahlen. */
  autoPrinted: boolean;
  onPrint: (orderIds: string[]) => void;
  printing: boolean;
  onNext: () => void;
  /** Weitere Beleg-Knöpfe (z. B. „Bewirtungsbeleg“). */
  extraHandout?: (orderIds: string[], helpers: { interact: () => void }) => ReactNode;
  /** Ansicht des Beleg-Bereichs von außen setzen. */
  handoutView?: HandoutView;
  onHandoutViewChange?: (view: HandoutView) => void;
}

/**
 * Ohne Rückgeld schließt das Blatt nach 5 s von selbst — aber nur, wenn
 * der Kassenbon schon automatisch gedruckt wurde. Sonst muss der Beleg
 * angeboten werden (Belegausgabepflicht § 146a Abs. 2 AO): das Blatt
 * bleibt, bis „Kein Beleg“ oder ein Beleg gewählt ist.
 */
const AUTO_CLOSE_MS = 5000;

/** Abschluss: „Bezahlt“, Betrag/Zahlart/Rückgeld, Bon-Vorschau, Beleg (QR/E-Mail/Druck), Nächster Bon. */
export function DoneSheet({
  info,
  title,
  eventName,
  deviceName,
  isTest,
  canPrint,
  autoPrinted,
  onPrint,
  printing,
  onNext,
  extraHandout,
  handoutView,
  onHandoutViewChange,
}: DoneSheetProps) {
  const t = useTranslations('pos.done');
  const formatPrice = useFormatPrice();

  const hasChange = !!info && info.method === 'cash' && info.change > 0.0001;
  // „Ohne Zahlung abschließen“ hat keinen Kassenbeleg.
  const hasReceipt = !!info && receiptAvailable(info.method, info.orderIds);
  const [interacted, setInteracted] = useState(false);
  useEffect(() => {
    setInteracted(false);
  }, [info]);
  // Nach der Zahlung steht der QR-Code sofort da. Selbst schließen nur,
  // wenn der Bon schon gedruckt ist (oder es keinen Beleg gibt).
  const autoClose = doneSheetAutoCloses({ hasChange, interacted, autoPrinted, receiptAvailable: hasReceipt });

  useEffect(() => {
    if (!info || !autoClose) return;
    const timer = window.setTimeout(onNext, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [info, autoClose, onNext]);

  if (!info) return null;

  // Marken plus Geld: „Bar + Wertmarken“.
  const methodLabel =
    info.method !== 'tokens' && (info.tokenValue ?? 0) > 0
      ? t('methodWithTokens', { method: t(`method.${info.method}`) })
      : t(`method.${info.method}`);
  const lines: ReceiptLine[] = [
    ...info.lines,
    ...(info.pfand > 0 ? [{ qty: '', name: t('pfand'), total: formatPrice(info.pfand) }] : []),
    ...(info.discount > 0 ? [{ qty: '', name: t('discount'), total: `-${formatPrice(info.discount)}` }] : []),
    ...(info.tip > 0 ? [{ qty: '', name: t('tip'), total: formatPrice(info.tip) }] : []),
    ...((info.tokenValue ?? 0) > 0
      ? [{ qty: '', name: t('tokensPaid'), total: `-${formatPrice(Math.min(info.tokenValue ?? 0, info.amount + info.tip))}` }]
      : []),
  ];

  return (
    <PosSheet open onClose={onNext} size="done" title={t('title')} hideHeader>
      <div className="pos-done">
        <span className="pos-done__ico">
          <Icon name="check-circle" size={44} />
        </span>
        <h3>{t('title')}</h3>
        <p>
          {formatPrice(info.amount + info.tip)} · {methodLabel}
          {hasChange && (
            <>
              {' · '}
              <b>{t('change', { amount: formatPrice(info.change) })}</b>
            </>
          )}
        </p>
        <Receipt
          className="pos-done__receipt"
          title={title}
          meta={info.orderNumber ? `#${info.orderNumber}` : (info.heading ?? undefined)}
          info={t('info', { event: eventName ?? '', device: deviceName, time: info.time })}
          lines={lines}
          sumLabel={t('sum')}
          sum={formatPrice(info.amount + info.tip)}
          note={isTest ? t('testReceipt') : undefined}
          foot={
            info.tse && info.tse.length > 0 ? (
              <div className="pos-done__tse">
                {info.tse.map((view) => (
                  <TseReceiptBlock key={view.id} view={view} qrSize={120} />
                ))}
              </div>
            ) : undefined
          }
        />
        {hasReceipt && (
          <ReceiptHandout
            key={info.orderIds.join(',')}
            orderIds={info.orderIds}
            canPrint={canPrint}
            autoPrinted={autoPrinted}
            onPrint={() => onPrint(info.orderIds)}
            printing={printing}
            onInteract={() => setInteracted(true)}
            extra={extraHandout?.(info.orderIds, { interact: () => setInteracted(true) })}
            view={handoutView}
            onViewChange={onHandoutViewChange}
            autoQr
            onNoReceipt={onNext}
          />
        )}
        <div className="pos-done__act">
          <Button variant="primary" className="oe-grow" onClick={onNext} data-testid="done-next">
            {t('next')}
            <Icon name="arrow-right" />
          </Button>
        </div>
      </div>
    </PosSheet>
  );
}
