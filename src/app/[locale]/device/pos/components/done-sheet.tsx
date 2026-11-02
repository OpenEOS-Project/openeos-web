'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon, Receipt, type ReceiptLine } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import { PosSheet } from './pos-sheet';

export interface DoneInfo {
  /** Bestellung(en), auf die sich der Bon bezieht. */
  orderIds: string[];
  orderNumber: string | null;
  /** Kopf bei mehreren Bestellungen, z. B. „Tisch A05 · 3 Bestellungen“. */
  heading?: string | null;
  amount: number;
  method: 'cash' | 'card' | 'sumup' | 'free';
  change: number;
  tip: number;
  lines: ReceiptLine[];
  pfand: number;
  discount: number;
  time: string;
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
}

/** Ohne Rückgeld schließt das Blatt nach 5 s von selbst. */
const AUTO_CLOSE_MS = 5000;

/** Abschluss: „Bezahlt“, Betrag/Zahlart/Rückgeld, Bon-Vorschau, Druck, Nächster Bon. */
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
}: DoneSheetProps) {
  const t = useTranslations('pos.done');
  const formatPrice = useFormatPrice();

  const hasChange = !!info && info.method === 'cash' && info.change > 0.0001;

  useEffect(() => {
    if (!info || hasChange) return;
    const timer = window.setTimeout(onNext, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [info, hasChange, onNext]);

  if (!info) return null;

  const methodLabel = t(`method.${info.method}`);
  const lines: ReceiptLine[] = [
    ...info.lines,
    ...(info.pfand > 0 ? [{ qty: '', name: t('pfand'), total: formatPrice(info.pfand) }] : []),
    ...(info.discount > 0 ? [{ qty: '', name: t('discount'), total: `-${formatPrice(info.discount)}` }] : []),
    ...(info.tip > 0 ? [{ qty: '', name: t('tip'), total: formatPrice(info.tip) }] : []),
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
        />
        <div className="pos-done__act">
          {canPrint && info.orderIds.length > 0 && (
            <Button variant="ghost" loading={printing} onClick={() => onPrint(info.orderIds)}>
              {!printing && <Icon name="print" />}
              {autoPrinted ? t('reprint') : t('print')}
            </Button>
          )}
          <Button variant="primary" className="oe-grow" onClick={onNext}>
            {t('next')}
            <Icon name="arrow-right" />
          </Button>
        </div>
      </div>
    </PosSheet>
  );
}
