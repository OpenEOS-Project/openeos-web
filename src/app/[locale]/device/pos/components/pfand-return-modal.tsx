'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState, Icon, Stepper } from '@openeos/ui';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import type { PfandType } from '@/types/pfand';
import type { CartPfandReturnLine } from '@/stores/cart-store';
import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';

interface PfandReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  pfandTypes: PfandType[];
  eventId?: string;
  /** Es gibt einen offenen Verkauf: „Verrechnen“ zieht die Rückgabe davon ab. */
  allowOffset?: boolean;
  /** Bereits verrechnete Rückgabe vorbelegen. */
  initialCounts?: Record<string, number>;
  onOffset?: (lines: CartPfandReturnLine[]) => void;
  /** Offline: Auszahlen gesperrt (Verrechnen bleibt lokal möglich). */
  payoutDisabled?: boolean;
}

/**
 * Pfand-Rückgabe: Zählung je Pfandart, dann „Auszahlen“ (Bargeld, öffnet
 * die Kassenlade) oder „Verrechnen“ gegen den aktuellen Warenkorb.
 */
export function PfandReturnModal({
  isOpen,
  onClose,
  pfandTypes,
  eventId,
  allowOffset = false,
  initialCounts,
  onOffset,
  payoutDisabled = false,
}: PfandReturnModalProps) {
  const t = useTranslations('pos.pfand');
  const tCart = useTranslations('pos.cartV2');
  const formatPrice = useFormatPrice();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCounts(initialCounts ?? {});
      setSubmitting(false);
    }
    // Nur beim Öffnen vorbelegen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const setQty = (id: string, qty: number) => setCounts((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
  const total = pfandTypes.reduce((sum, pt) => sum + Number(pt.amount) * (counts[pt.id] || 0), 0);

  const payout = async () => {
    const lines = pfandTypes
      .filter((pt) => (counts[pt.id] || 0) > 0)
      .map((pt) => ({ pfandTypeId: pt.id, quantity: counts[pt.id] }));
    if (lines.length === 0) return;
    setSubmitting(true);
    try {
      await deviceApi.createPfandReturn({ ...(eventId ? { eventId } : {}), lines });
      toast(tCart('pfandPaidOut', { amount: formatPrice(total) }));
      onClose();
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const offset = () => {
    onOffset?.(
      pfandTypes
        .filter((pt) => (counts[pt.id] || 0) > 0)
        .map((pt) => ({
          pfandTypeId: pt.id,
          name: pt.name,
          unitAmount: Number(pt.amount),
          quantity: counts[pt.id],
        })),
    );
  };

  return (
    <PosSheet
      open={isOpen}
      onClose={onClose}
      icon="deposit"
      title={t('returnTitle')}
      subtitle={`${t('returnSum')}: ${formatPrice(total)}`}
      footer={
        <>
          <Button
            variant={allowOffset ? 'secondary' : 'primary'}
            className={allowOffset ? undefined : 'oe-grow'}
            disabled={total <= 0 || submitting || payoutDisabled}
            loading={submitting}
            onClick={payout}
          >
            {!submitting && <Icon name="cash" />}
            {t('payoutButton')}
          </Button>
          {allowOffset && (
            <Button variant="primary" className="oe-grow" disabled={total <= 0} onClick={offset}>
              <Icon name="check" />
              {t('offsetButton')}
            </Button>
          )}
        </>
      }
    >
      {pfandTypes.length === 0 ? (
        <EmptyState icon={<Icon name="deposit" />} title={t('empty')} />
      ) : (
        <ul className="pos-list">
          {pfandTypes.map((pt) => {
            const qty = counts[pt.id] || 0;
            return (
              <li key={pt.id} className="pos-list__row">
                <span className="pos-list__main">
                  <b>{pt.name}</b>
                  <small>{formatPrice(Number(pt.amount))}</small>
                </span>
                <Stepper
                  value={qty}
                  onDecrement={() => setQty(pt.id, qty - 1)}
                  onIncrement={() => setQty(pt.id, qty + 1)}
                  labels={{ decrease: t('decrease'), increase: t('increase') }}
                />
              </li>
            );
          })}
        </ul>
      )}
      {allowOffset && <p className="pos-hint">{t('offsetHint')}</p>}
    </PosSheet>
  );
}
