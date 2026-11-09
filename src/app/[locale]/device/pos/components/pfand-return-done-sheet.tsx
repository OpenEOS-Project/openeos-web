'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon, Receipt, type ReceiptLine } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import { TseReceiptBlock } from '@/components/tse/tse-receipt-block';
import type { PfandReturn } from '@/types/pfand';
import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';

/** Wie beim Verkauf: das Blatt schließt nach 5 s von selbst. */
const AUTO_CLOSE_MS = 5000;

export interface PfandReturnReceiptContext {
  /** Kopf des Bons (Organisationsname). */
  title: string;
  eventName: string | null;
  deviceName: string;
  isTest: boolean;
  /** Bondrucker vorhanden? Ohne keinen Druckknopf. */
  canPrint: boolean;
}

interface PfandReturnDoneSheetProps {
  /** Gebuchte Auszahlung; `null` = Blatt geschlossen. */
  result: PfandReturn | null;
  context: PfandReturnReceiptContext;
  onClose: () => void;
}

/**
 * Abschluss einer Pfand-Auszahlung: Betrag bar, Beleg-Vorschau mit
 * Belegnummer und TSE-Angaben, „Bon drucken“. Gedruckt wird wie beim
 * Verkauf: automatisch, wenn die Organisation Kassenbons nach der Zahlung
 * druckt (dann „Bon erneut drucken“), sonst auf Wunsch.
 */
export function PfandReturnDoneSheet({ result, context, onClose }: PfandReturnDoneSheetProps) {
  const t = useTranslations('pos.pfandDone');
  const tDone = useTranslations('pos.done');
  const formatPrice = useFormatPrice();
  const toast = usePosToast();
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  // Läuft der Druck noch, bleibt das Blatt offen.
  const [hold, setHold] = useState(false);

  useEffect(() => {
    setPrinted(!!result?.printed);
    setHold(false);
  }, [result]);

  useEffect(() => {
    if (!result || hold) return;
    const timer = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [result, hold, onClose]);

  if (!result) return null;

  const total = Math.abs(Number(result.totalAmount));
  const time = new Date(result.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const lines: ReceiptLine[] = result.lines.map((line) => ({
    qty: `${line.quantity}×`,
    name: line.name,
    total: formatPrice(-Number(line.unitAmount) * line.quantity),
  }));
  const tse = result.tse ? [result.tse] : [];

  const print = async () => {
    setHold(true);
    setPrinting(true);
    try {
      const res = await deviceApi.printPfandReturn(result.id, printed);
      if (res.data?.printed) {
        setPrinted(true);
        toast(tDone('printed'));
      } else {
        toast(t('noPrinter'), 'danger');
      }
    } catch {
      toast(tDone('printFailed'), 'danger');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PosSheet open onClose={onClose} size="done" title={t('title')} hideHeader>
      <div className="pos-done" data-testid="pfand-return-done">
        <span className="pos-done__ico">
          <Icon name="deposit" size={44} />
        </span>
        <h3>{t('title')}</h3>
        <p>
          <b>{formatPrice(total)}</b> · {t('cash')}
          {printed && <> · {t('printed')}</>}
        </p>
        <Receipt
          className="pos-done__receipt"
          title={context.title}
          meta={result.returnNumber ?? undefined}
          info={tDone('info', { event: context.eventName ?? '', device: context.deviceName, time })}
          lines={lines}
          sumLabel={t('sum')}
          sum={formatPrice(-total)}
          note={context.isTest ? tDone('testReceipt') : undefined}
          foot={
            tse.length > 0 ? (
              <div className="pos-done__tse">
                {tse.map((view) => (
                  <TseReceiptBlock key={view.id} view={view} qrSize={120} />
                ))}
              </div>
            ) : undefined
          }
        />
        <div className="pos-done__act">
          {context.canPrint && (
            <Button variant="ghost" loading={printing} onClick={print}>
              {!printing && <Icon name="print" />}
              {printed ? tDone('reprint') : tDone('print')}
            </Button>
          )}
          <Button variant="primary" className="oe-grow" onClick={onClose}>
            {t('done')}
          </Button>
        </div>
      </div>
    </PosSheet>
  );
}
