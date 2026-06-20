'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Delete, X } from '@untitledui/icons';
import { formatCurrency } from '@/utils/format';

interface CashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirm: () => void;
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
  const press = (digit: string) => {
    if (value.length < maxLength) onChange(value + digit);
  };
  const back = () => onChange(value.slice(0, -1));
  const clear = () => onChange('');

  const keyStyle: React.CSSProperties = {
    height: 52,
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
      <button type="button" onClick={clear} style={auxStyle} aria-label="Löschen">
        C
      </button>
      {renderDigit('0')}
      <button type="button" onClick={back} style={auxStyle} aria-label="Zurück">
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
  const [received, setReceived] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReceived('');
      setIsClosing(false);
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

  const handleClose = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-payment-title"
      style={{ position: 'fixed', inset: 0, zIndex: 50 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Dimmed backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(20,18,12,.45)',
          opacity: isClosing ? 0 : 1,
          transition: 'opacity .2s ease',
        }}
      />

      {/* Bottom-anchored sheet */}
      <div
        className="pos-sheet"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '92%',
          background: 'var(--pos-surface)',
          borderTopLeftRadius: 'var(--pos-r-lg)',
          borderTopRightRadius: 'var(--pos-r-lg)',
          boxShadow: 'var(--pos-sh-3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isClosing ? 'translateY(100%)' : undefined,
          transition: 'transform .22s ease',
          animation: isClosing ? undefined : 'pos-slide-up-sheet .22s ease',
        }}
      >
        {/* Drag handle stripe */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 28,
            flexShrink: 0,
          }}
        >
          <div style={{ width: 48, height: 5, background: 'var(--pos-line-strong)', borderRadius: 999 }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px 12px',
            borderBottom: '1px solid var(--pos-line)',
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              id="cash-payment-title"
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--pos-ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {t('title')}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--pos-ink-3)', marginTop: 2 }}>
              {t('amountDue')}: <strong style={{ color: 'var(--pos-ink)' }}>{formatCurrency(total)}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Schließen"
            style={{
              width: 36,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              color: 'var(--pos-ink-3)',
              borderRadius: 'var(--pos-r-sm)',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: 22, height: 22 }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="pos-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 18px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Quick amount pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {quickAmounts.map((amount) => {
              const on = receivedAmount === amount;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setReceived(Math.round(amount * 100).toString())}
                  style={{
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: on ? 'var(--pos-accent)' : 'var(--pos-surface-2)',
                    color: on ? 'var(--pos-accent-contrast)' : 'var(--pos-ink)',
                    border: `1px solid ${on ? 'var(--pos-accent)' : 'var(--pos-line)'}`,
                    borderRadius: 999,
                    cursor: 'pointer',
                    transition: 'background .12s, color .12s, border-color .12s',
                  }}
                >
                  {formatCurrency(amount)}
                </button>
              );
            })}
          </div>

          {/* Received display + change side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div
              style={{
                background: 'var(--pos-surface-2)',
                border: '1px solid var(--pos-line)',
                borderRadius: 'var(--pos-r-md)',
                padding: '10px 12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--pos-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('received')}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: 'var(--pos-ff-mono)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--pos-ink)',
                  lineHeight: 1.2,
                }}
              >
                {received ? formatCurrency(receivedAmount) : '—'}
              </div>
            </div>
            <div
              style={{
                background: canConfirm
                  ? 'var(--pos-accent-soft)'
                  : 'var(--pos-surface-2)',
                border: `1px solid ${
                  canConfirm ? 'var(--pos-ok)' : 'var(--pos-line)'
                }`,
                borderRadius: 'var(--pos-r-md)',
                padding: '10px 12px',
                textAlign: 'center',
                transition: 'background .12s, border-color .12s',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--pos-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('change')}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: 'var(--pos-ff-mono)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: canConfirm ? 'var(--pos-ok)' : 'var(--pos-ink-3)',
                  lineHeight: 1.2,
                }}
              >
                {formatCurrency(change)}
              </div>
            </div>
          </div>

          {/* Numpad */}
          <PosNumpad value={received} onChange={setReceived} maxLength={7} />
        </div>

        {/* Sticky confirm footer */}
        <div
          style={{
            padding: '10px 18px 18px',
            borderTop: '1px solid var(--pos-line)',
            background: 'var(--pos-surface)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => canConfirm && onConfirm()}
            disabled={!canConfirm}
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 15,
              fontWeight: 700,
              background: canConfirm ? 'var(--pos-accent)' : 'var(--pos-line)',
              color: canConfirm ? 'var(--pos-accent-contrast)' : 'var(--pos-ink-3)',
              border: 'none',
              borderRadius: 'var(--pos-r-md)',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background .12s, color .12s',
            }}
          >
            {!isProcessing && <Check style={{ width: 20, height: 20 }} />}
            {isProcessing ? '…' : t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
