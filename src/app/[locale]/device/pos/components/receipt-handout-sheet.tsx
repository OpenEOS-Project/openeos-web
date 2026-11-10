'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { deviceApi } from '@/lib/api-client';

import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';
import { ReceiptHandout, type HandoutView } from './receipt-handout';

interface ReceiptHandoutSheetProps {
  /** Bestellung, deren Beleg (neu) ausgegeben wird; null = zu. */
  orderId: string | null;
  orderNumber?: string | null;
  canPrint: boolean;
  onClose: () => void;
  /** Weitere Knöpfe (z. B. „Bewirtungsbeleg“). */
  extra?: (helpers: { setView: (view: HandoutView) => void }) => ReactNode;
}

/**
 * „Beleg“ aus dem Verlauf der Kasse: denselben Kassenbeleg später noch
 * einmal ausgeben — QR-Code, E-Mail oder Bon. Der Beleg entsteht jedes Mal
 * neu aus den gespeicherten Kassendaten.
 */
export function ReceiptHandoutSheet({ orderId, orderNumber, canPrint, onClose, extra }: ReceiptHandoutSheetProps) {
  const t = useTranslations('pos.receiptHandout');
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const [printing, setPrinting] = useState(false);
  const [view, setView] = useState<HandoutView>('qr');

  const print = async () => {
    if (!orderId) return;
    setPrinting(true);
    try {
      const res = await deviceApi.reprintOrder(orderId, 'receipt');
      if (res.data?.printed === false) toast(t('noPrinter'), 'danger');
      else toast(t('printed'));
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PosSheet
      open={!!orderId}
      onClose={() => {
        setView('qr');
        onClose();
      }}
      size="done"
      icon="receipt"
      title={t('sheetTitle')}
      subtitle={orderNumber ?? undefined}
    >
      {orderId && (
        <ReceiptHandout
          key={orderId}
          orderIds={[orderId]}
          canPrint={canPrint}
          onPrint={() => void print()}
          printing={printing}
          autoQr
          view={view}
          onViewChange={setView}
          extra={extra?.({ setView })}
        />
      )}
    </PosSheet>
  );
}
