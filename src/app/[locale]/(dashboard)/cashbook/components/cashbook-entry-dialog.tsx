'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { PriceInput } from '@/components/shared/price-input';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { cashDifference, differenceTone, roundEuros } from '@/lib/dsfinvk';
import type { CashbookEntryType, CreateCashbookEntryData } from '@/types/dsfinvk';

interface CashbookEntryDialogProps {
  /** Art der Buchung; `null` = geschlossen. */
  type: CashbookEntryType | null;
  /** Soll-Bestand der ganzen Kasse (für den Kassensturz). */
  expected: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCashbookEntryData) => void;
}

/**
 * Buchung für die ganze Kasse in der Verwaltung: Betrag und Notiz; beim
 * Kassensturz der gezählte Bestand mit Soll und laufender Differenz.
 */
export function CashbookEntryDialog({ type, expected, pending, onClose, onSubmit }: CashbookEntryDialogProps) {
  const t = useTranslations('cashbook');
  const tCommon = useTranslations('common');
  const { formatCurrency } = useLocaleFormat();
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (type) {
      setAmount(0);
      setNote('');
    }
  }, [type]);

  useEffect(() => {
    if (!type) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [type, pending, onClose]);

  if (!type) return null;

  const isCount = type === 'cash_count';
  const value = roundEuros(Number.isFinite(amount) ? amount : 0);
  const difference = cashDifference(value, expected);
  const tone = differenceTone(difference);
  // Anfangsbestand und Kassensturz dürfen 0 sein, Einlage und Entnahme nicht.
  const valid = value >= 0 && value <= 100000 && (isCount || type === 'opening_balance' || value > 0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || pending) return;
    onSubmit({ type, amount: value, ...(note.trim() ? { note: note.trim() } : {}) });
  };

  return (
    <div className="modal__overlay" onClick={() => !pending && onClose()}>
      <ModalPanel titleId="cashbook-entry-title" className="modal__panel--sm">
        <div className="modal__head">
          <h2 id="cashbook-entry-title">{t(`types.${type}`)}</h2>
          <DialogCloseButton onClick={() => !pending && onClose()} />
        </div>
        <form onSubmit={submit}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="cashbook-entry-dialog">
            <p style={{ margin: 0, fontSize: 13 }}>{t(`dialog.adminText.${type}`)}</p>
            <label className="auth-field">
              <span>{isCount ? t('dialog.counted') : t('dialog.amount')}</span>
              <PriceInput value={amount} onChange={(v) => setAmount(Number.isFinite(v) ? v : 0)} invalid={!valid && amount !== 0} />
            </label>
            {isCount && (
              <dl className="cb-diff" data-tone={tone} data-testid="cashbook-difference">
                <div>
                  <dt>{t('dialog.expected')}</dt>
                  <dd>{formatCurrency(expected)}</dd>
                </div>
                <div className="cb-diff__result">
                  <dt>{t(`dialog.difference_${tone}`)}</dt>
                  <dd>
                    {difference > 0 ? '+' : ''}
                    {formatCurrency(difference)}
                  </dd>
                </div>
              </dl>
            )}
            {isCount && <p className="auth-field__hint" style={{ margin: 0 }}>{t('dialog.differenceHint')}</p>}
            <label className="auth-field">
              <span>{t('dialog.note')}</span>
              <input
                className="input"
                value={note}
                maxLength={500}
                placeholder={t(`dialog.notePlaceholder.${type}`)}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={pending}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={!valid || pending} data-testid="cashbook-entry-submit">
              {pending ? t('dialog.booking') : t(`dialog.confirm.${type}`)}
            </button>
          </div>
        </form>
      </ModalPanel>
    </div>
  );
}
