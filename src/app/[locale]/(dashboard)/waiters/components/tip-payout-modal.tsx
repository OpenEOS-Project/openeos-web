'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { PriceInput } from '@/components/shared/price-input';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePrinters } from '@/hooks/use-printers';
import { usePayOutTips, useTipPayoutStatus } from '@/hooks/use-waiters';
import { canPayOutCardTips } from '@/lib/waiters';

interface TipPayoutModalProps {
  organizationId: string;
  waiterId: string;
  waiterName: string;
  eventId: string | null;
  onClose: () => void;
  onPaid?: () => void;
}

/**
 * Kartentrinkgeld bar auszahlen (Steuerberater 2026-11-10, Frage 5): nur
 * für Bedienungen mit „Arbeitnehmer (Lohnkonto)“ — eigener TSE-Beleg
 * (TrinkgeldAN), Quittung mit Unterschrift, mindert den Soll-Bestand. Bei
 * Ehrenamtlichen gehört das Trinkgeld dem Verein: nur die Erklärung.
 */
export function TipPayoutModal({ organizationId, waiterId, waiterName, eventId, onClose, onPaid }: TipPayoutModalProps) {
  const t = useTranslations('waiterSettlement.tipPayout');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatCurrency, formatDateTime } = useLocaleFormat();
  const status = useTipPayoutStatus(organizationId, waiterId);
  const payOut = usePayOutTips(organizationId);
  const { data: printers = [] } = usePrinters(organizationId);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [printerId, setPrinterId] = useState('');

  const data = status.data;
  const open = data?.openCardTips ?? 0;
  useEffect(() => {
    if (data) setAmount(data.openCardTips);
  }, [data]);

  const valid = amount > 0 && Math.round(amount * 100) <= Math.round(open * 100);
  const canPay = !!data?.isEmployee && canPayOutCardTips(open);

  const submit = () => {
    if (!canPay || !valid) return;
    payOut.mutate(
      {
        waiterId,
        data: {
          amount,
          ...(eventId ? { eventId } : {}),
          note: note.trim() || null,
          ...(printerId ? { printerId } : {}),
        },
      },
      {
        onSuccess: (result) => {
          toast.success(t('paid', { amount: formatCurrency(result.data.amount), name: waiterName }));
          if (printerId && result.meta && !result.meta.printed) toast.error(t('notPrinted'));
          onPaid?.();
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, t('failed'))),
      },
    );
  };

  let body;
  if (status.isLoading) body = <p className="settle-period">{tCommon('loading')}</p>;
  else if (status.error || !data) body = <p className="waiters-form__error">{apiErrorMessage(status.error, t('loadFailed'))}</p>;
  else if (!data.isEmployee) body = <p data-testid="tip-payout-volunteer">{t('volunteer')}</p>;
  else
    body = (
      <>
        <p>{t('intro', { open: formatCurrency(open) })}</p>
        {canPay ? (
          <>
            <label className="auth-field">
              <span>{t('amount')}</span>
              <PriceInput value={amount} onChange={(v) => setAmount(Number.isFinite(v) ? v : 0)} invalid={!valid} />
              <small className="auth-field__hint">{t('amountHint', { open: formatCurrency(open) })}</small>
            </label>
            <label className="auth-field">
              <span>{t('note')}</span>
              <input className="input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </label>
            <label className="auth-field">
              <span>{t('printer')}</span>
              <select className="select" value={printerId} onChange={(e) => setPrinterId(e.target.value)}>
                <option value="">{t('noPrint')}</option>
                {printers
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <p className="waiters-form__hint">{t('effect')}</p>
          </>
        ) : (
          <p className="waiters-form__hint">{t('nothingOpen')}</p>
        )}
        {data.payouts.length > 0 && (
          <div>
            <h3 style={{ fontSize: 13, margin: '8px 0 4px' }}>{t('history')}</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {data.payouts.map((p) => (
                <li key={p.id}>
                  {formatDateTime(p.createdAt)} · {formatCurrency(p.amount)}
                  {p.tse?.bonNumber ? ` · ${t('bon', { bon: p.tse.bonNumber })}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="tip-payout-title" className="modal__panel--sm">
        <div className="modal__head">
          <h2 id="tip-payout-title">{t('title', { name: waiterName })}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="modal__body">
          <div className="waiters-form" data-testid="tip-payout">
            {body}
          </div>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {canPay ? tCommon('cancel') : tCommon('close')}
          </button>
          {canPay && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={submit}
              disabled={!valid || payOut.isPending}
              data-testid="tip-payout-submit"
            >
              {payOut.isPending ? tCommon('saving') : t('submit', { amount: formatCurrency(amount) })}
            </button>
          )}
        </div>
      </ModalPanel>
    </div>
  );
}
