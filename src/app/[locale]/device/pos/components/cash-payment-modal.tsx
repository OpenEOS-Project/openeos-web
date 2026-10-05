'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Delete } from '@untitledui/icons';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import { PosSheet, usePosSheetClose } from './pos-sheet';

interface CashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirm: (amountReceived: number) => void;
  isProcessing?: boolean;
}

/** POS-styled numpad — uses --pos-* tokens to match the kasse design. */
export function PosNumpad({
  value,
  onChange,
  maxLength = 7,
}: {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
}) {
  const tUi = useTranslations('deviceUi.common');
  const press = (digit: string) => {
    if (value.length < maxLength) onChange(value + digit);
  };
  const back = () => onChange(value.slice(0, -1));
  const clear = () => onChange('');

  const keyStyle: React.CSSProperties = {
    // Auf kleinen Telefonen etwas flacher, damit der ganze Block samt
    // Bestaetigen-Knopf ohne Scrollen sichtbar bleibt; nie unter 44px.
    height: 'clamp(44px, 6.5dvh, 52px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--pos-surface)',
    border: '1px solid var(--pos-line)',
    borderRadius: 'var(--pos-r-md)',
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--pos-ink)',
    cursor: 'pointer',
    boxShadow: 'var(--pos-sh-1)',
    transition: 'transform .06s ease, background .12s, border-color .12s',
  };
  const auxStyle: React.CSSProperties = {
    ...keyStyle,
    background: 'var(--pos-surface-2)',
    color: 'var(--pos-ink-2)',
    fontSize: 17,
    boxShadow: 'none',
  };

  const renderDigit = (d: string) => (
    <button
      key={d}
      type="button"
      onClick={() => press(d)}
      onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(.97)')}
      onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      style={keyStyle}
    >
      {d}
    </button>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(renderDigit)}
      <button type="button" onClick={clear} style={auxStyle} aria-label={tUi('clear')}>
        C
      </button>
      {renderDigit('0')}
      <button type="button" onClick={back} style={auxStyle} aria-label={tUi('backspace')}>
        <Delete style={{ width: 20, height: 20 }} />
      </button>
    </div>
  );
}

export function CashPaymentModal({
  isOpen,
  onClose,
  total,
  onConfirm,
  isProcessing = false,
}: CashPaymentModalProps) {
  const t = useTranslations('pos.cashPayment');
  const formatCurrency = useFormatPrice();
  const [received, setReceived] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReceived('');
      // Pop the cash drawer as soon as the cashier starts the cash payment,
      // so they can make change while entering the amount — not only after the
      // payment is confirmed. Fire-and-forget; ignore "no drawer configured".
      deviceApi.openCashDrawer().catch(() => {});
    }
  }, [isOpen]);

  const receivedAmount = useMemo(() => {
    if (!received) return 0;
    return parseInt(received, 10) / 100;
  }, [received]);

  const change = Math.max(0, receivedAmount - total);
  const canConfirm = receivedAmount >= total && !isProcessing;

  const quickAmounts = useMemo(() => {
    const out = new Set<number>([total]);
    const rounded = Math.ceil(total);
    if (rounded !== total) out.add(rounded);
    for (const a of [5, 10, 20, 50, 100]) {
      if (a > total) out.add(a);
      if (out.size >= 5) break;
    }
    return Array.from(out).slice(0, 5);
  }, [total]);

  const { closing, close } = usePosSheetClose(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <PosSheet
      closing={closing}
      onClose={close}
      title={t('title')}
      subtitle={
        <>
          {t('amountDue')}: <strong>{formatCurrency(total)}</strong>
        </>
      }
      bodyStyle={{ paddingBottom: 10 }}
      pinned={
        // Ziffernblock ausserhalb des scrollbaren Bereichs, damit die untere
        // Reihe (C / 0 / Loeschen) nie hinter dem Fuss verschwindet.
        <PosNumpad value={received} onChange={setReceived} maxLength={7} />
      }
      footer={
        <button
          type="button"
          className="pos-btn pos-btn--primary"
          style={{ width: '100%' }}
          onClick={() => canConfirm && onConfirm(receivedAmount)}
          disabled={!canConfirm}
        >
          {!isProcessing && <Check />}
          {isProcessing ? '…' : t('confirm')}
        </button>
      }
    >
      {/* Schnellbetraege — eine Zeile, seitlich wischbar, damit sie auf dem
          Telefon nicht zwei Zeilen Hoehe kosten. */}
      <div className="pos-chips pos-scroll" style={{ flexShrink: 0 }}>
        {quickAmounts.map((amount) => (
          <button
            key={amount}
            type="button"
            className="pos-chip"
            aria-pressed={receivedAmount === amount}
            onClick={() => setReceived(Math.round(amount * 100).toString())}
          >
            {formatCurrency(amount)}
          </button>
        ))}
      </div>

      {/* Erhalten und Rueckgeld nebeneinander */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <AmountTile label={t('received')} value={received ? formatCurrency(receivedAmount) : '—'} />
        <AmountTile label={t('change')} value={formatCurrency(change)} highlight={canConfirm} />
      </div>
    </PosSheet>
  );
}

function AmountTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        background: highlight ? 'var(--pos-accent-soft)' : 'var(--pos-surface-2)',
        border: `1px solid ${highlight ? 'var(--pos-ok)' : 'var(--pos-line)'}`,
        borderRadius: 'var(--pos-r-md)',
        padding: '10px 12px',
        textAlign: 'center',
        transition: 'background .12s, border-color .12s',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--pos-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div
        className="pos-mono"
        style={{
          marginTop: 2,
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.2,
          color: highlight ? 'var(--pos-accent-ink)' : 'var(--pos-ink)',
        }}
      >
        {value}
      </div>
    </div>
  );
}
