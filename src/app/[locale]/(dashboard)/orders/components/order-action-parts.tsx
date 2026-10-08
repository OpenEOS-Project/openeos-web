'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import type { RefundReasonCode } from '@/types/order-history';

/** Gedämpfte Schrift wie im übrigen Bestelldetail. */
export const muted = 'color-mix(in oklab, var(--ink) 50%, transparent)';

/** Menge 0 … max mit Minus/Plus (Verwaltung; die Kasse nutzt den großen Stepper). */
export function QtyStepper({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const t = useTranslations('orders.refund');
  return (
    <span className="order-action__stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="btn btn--ghost btn--icon btn--sm"
        aria-label={t('less', { name: label })}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Icon name="minus" size={14} />
      </button>
      <b className="mono" aria-live="polite">
        {value}
        <small>/{max}</small>
      </b>
      <button
        type="button"
        className="btn btn--ghost btn--icon btn--sm"
        aria-label={t('more', { name: label })}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Icon name="plus" size={14} />
      </button>
    </span>
  );
}

/** Grund (Auswahl) und Ergänzung (Freitext). */
export function ReasonFields({
  required,
  reasonCode,
  reasonText,
  codes,
  onReasonCode,
  onReasonText,
}: {
  required: boolean;
  reasonCode: RefundReasonCode | null;
  reasonText: string;
  codes: RefundReasonCode[];
  onReasonCode: (code: RefundReasonCode | null) => void;
  onReasonText: (text: string) => void;
}) {
  const t = useTranslations('orders.refund');
  const tHistory = useTranslations('orders.history');
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)' }}>
      <div className="auth-field">
        <label className="auth-field__label" htmlFor="order-action-reason">
          {required ? t('reasonRequired') : t('reasonOptional')}
        </label>
        <select
          id="order-action-reason"
          className="select"
          value={reasonCode ?? ''}
          onChange={(e) => onReasonCode((e.target.value || null) as RefundReasonCode | null)}
        >
          <option value="">{t('reasonChoose')}</option>
          {codes.map((code) => (
            <option key={code} value={code}>
              {tHistory(`reasons.${code}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="auth-field">
        <label className="auth-field__label" htmlFor="order-action-reason-text">
          {t('reasonText')}
        </label>
        <input
          id="order-action-reason-text"
          className="input"
          value={reasonText}
          maxLength={500}
          placeholder={t('reasonPlaceholder')}
          onChange={(e) => onReasonText(e.target.value)}
        />
      </div>
    </div>
  );
}

/** Küche hat begonnen: Storno nur mit ausdrücklicher Bestätigung. */
export function StartedWarning({
  items,
  checked,
  onChange,
}: {
  items: string[];
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useTranslations('orders.refund');
  return (
    <div role="alert" className="order-action__alert">
      <b>
        <Icon name="alert" size={16} /> {t('startedTitle')}
      </b>
      <span>{t('startedText', { items: items.join(', ') })}</span>
      <label className="order-action__check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>
          <b>{t('startedConfirm')}</b>
        </span>
      </label>
    </div>
  );
}
