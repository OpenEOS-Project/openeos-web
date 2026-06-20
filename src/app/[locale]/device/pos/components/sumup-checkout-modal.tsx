'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard01, CheckCircle, XCircle, Loading02 } from '@untitledui/icons';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';

type CheckoutState = 'tip' | 'initiating' | 'waiting' | 'success' | 'failed' | 'cancelled';

interface SumUpCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: (tip: number) => void;
}

// Trinkgeld-Vorschläge (in EUR) für die Kartenzahlung.
const TIP_PRESETS = [0, 0.5, 1, 2] as const;

const KNOWN_ERRORS = [
  'READER_BUSY',
  'READER_OFFLINE',
  'READER_NOT_FOUND',
  'INVALID_AMOUNT',
  'CHECKOUT_ALREADY_IN_PROGRESS',
] as const;

export function SumUpCheckoutModal({ isOpen, onClose, amount, onSuccess }: SumUpCheckoutModalProps) {
  const t = useTranslations('pos.sumupCheckout');
  const [state, setState] = useState<CheckoutState>('tip');
  const [error, setError] = useState<string | null>(null);
  // Vom Kassierer gewähltes Trinkgeld; wird vor dem Checkout bestätigt.
  const [tip, setTip] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);
  // client_transaction_id of the active reader checkout — used to poll the
  // transaction result (the reader status alone never reports success).
  const txnIdRef = useRef<string | null>(null);
  // Bestätigtes Trinkgeld zum Zeitpunkt des Checkout-Starts — wird an
  // onSuccess zurückgegeben, damit Order + Zahlung den Betrag erfassen.
  const tipRef = useRef(0);

  const getErrorMessage = (err: unknown): string => {
    const message = err instanceof Error ? err.message : '';
    const errorType = KNOWN_ERRORS.find((type) => message.includes(type));
    if (errorType) {
      return t(`errors.${errorType}`);
    }
    return message || t('failed');
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const terminateReader = async () => {
    try {
      await deviceApi.terminateCheckout();
    } catch {
      // Ignore — reader may not have an active checkout
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      if (!cancelledRef.current) {
        terminateReader();
      }
      cancelledRef.current = false;
      setState('tip');
      setTip(0);
      setError(null);
      return;
    }

    // Beim Öffnen wird die Zahlung NICHT sofort gestartet — zuerst wählt der
    // Kassierer das Trinkgeld, danach wird der Checkout über confirmTip() initiiert.
    cancelledRef.current = false;
    setState('tip');
    setTip(0);
    setError(null);

    return () => {
      stopPolling();
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Startet den Reader-Checkout über den Gesamtbetrag (Warenkorb + Trinkgeld).
  const startCheckout = async (tipValue: number) => {
    cancelledRef.current = false;
    tipRef.current = tipValue;
    setState('initiating');
    setError(null);

    try {
      const initResp = await deviceApi.initiateCheckout(amount + tipValue);
      txnIdRef.current =
        (initResp as { data?: { data?: { client_transaction_id?: string } } })
          ?.data?.data?.client_transaction_id ?? null;
      if (cancelledRef.current) {
        await terminateReader();
        return;
      }
      setState('waiting');
      startPolling();
    } catch (err) {
      if (cancelledRef.current) return;
      setState('failed');
      setError(getErrorMessage(err));
    }
  };

  const startPolling = () => {
    stopPolling();

    pollingRef.current = setInterval(async () => {
      if (cancelledRef.current) {
        stopPolling();
        return;
      }

      try {
        const response = await deviceApi.getCheckoutStatus(txnIdRef.current ?? undefined);
        const data = (response as { data?: { checkout?: { status?: string } } }).data;

        if (!data || cancelledRef.current) return;

        const checkoutStatus = data.checkout?.status;

        if (checkoutStatus === 'SUCCESSFUL' || checkoutStatus === 'successful') {
          stopPolling();
          setState('success');
          setTimeout(() => {
            onSuccess(tipRef.current);
            onClose();
          }, 1500);
        } else if (checkoutStatus === 'FAILED' || checkoutStatus === 'failed') {
          stopPolling();
          setState('failed');
          setError(t('failed'));
        } else if (checkoutStatus === 'CANCELLED' || checkoutStatus === 'cancelled') {
          stopPolling();
          setState('cancelled');
        }
      } catch {
        // Ignore polling errors, keep trying
      }
    }, 2000);
  };

  const handleRetry = () => {
    // Erneut mit dem bereits bestätigten Trinkgeld starten.
    startCheckout(tipRef.current);
  };

  const handleCancel = async () => {
    cancelledRef.current = true;
    stopPolling();
    setState('cancelled');
    await terminateReader();
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const isLocked = state === 'waiting' || state === 'initiating';

  if (!isOpen) return null;

  const iconColor =
    state === 'success' ? 'var(--pos-ok)' :
    state === 'failed' || state === 'cancelled' ? 'var(--pos-danger)' :
    'var(--pos-accent)';

  const iconBg =
    state === 'success' ? 'var(--pos-accent-soft)' :
    state === 'failed' || state === 'cancelled' ? 'rgba(189, 65, 63, 0.12)' :
    'var(--pos-accent-soft)';

  const Icon =
    state === 'success' ? CheckCircle :
    state === 'failed' || state === 'cancelled' ? XCircle :
    CreditCard01;

  const message =
    state === 'initiating' ? t('processing') :
    state === 'waiting' ? t('waiting') :
    state === 'success' ? t('success') :
    state === 'failed' ? (error || t('failed')) :
    t('cancelled');

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLocked) onClose();
      }}
    >
      <div
        onClick={isLocked ? undefined : onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(20,18,12,.55)',
          animation: 'pos-fade-in .18s ease',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          background: 'var(--pos-surface)',
          borderRadius: 'var(--pos-r-lg)',
          boxShadow: 'var(--pos-sh-3)',
          overflow: 'hidden',
          animation: 'pos-pop .22s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--pos-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--pos-ink)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            {t('title')}
          </h2>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '32px 24px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 999,
              background: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background .15s',
            }}
          >
            <Icon style={{ width: 38, height: 38, color: iconColor }} />
          </div>

          <p
            className="pos-mono"
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: 'var(--pos-ink)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {formatCurrency(amount + tip)}
          </p>

          {state === 'tip' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
              <p style={{ fontSize: 14, color: 'var(--pos-ink-3)', margin: 0, fontWeight: 600 }}>
                {t('tipLabel')}
              </p>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                {TIP_PRESETS.map((preset) => {
                  const selected = tip === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTip(preset)}
                      style={{
                        flex: 1,
                        padding: '12px 4px',
                        background: selected ? 'var(--pos-accent)' : 'var(--pos-surface-2)',
                        color: selected ? 'var(--pos-accent-contrast)' : 'var(--pos-ink)',
                        border: `1px solid ${selected ? 'var(--pos-accent)' : 'var(--pos-line-strong)'}`,
                        borderRadius: 'var(--pos-r-sm)',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {preset === 0 ? t('tipNone') : `+${formatCurrency(preset)}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <p style={{ fontSize: 15, color: 'var(--pos-ink)', margin: 0, fontWeight: 500 }}>
                {message}
              </p>
              {tip > 0 && (
                <p style={{ fontSize: 13, color: 'var(--pos-ink-3)', margin: 0 }}>
                  {t('tipIncluded', { tip: formatCurrency(tip) })}
                </p>
              )}
              {isLocked && (
                <Loading02
                  style={{
                    width: 22,
                    height: 22,
                    color: 'var(--pos-ink-3)',
                    animation: 'spin 1s linear infinite',
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--pos-line)',
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--pos-surface-2)',
          }}
        >
          {state === 'tip' && (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '12px 18px',
                  background: 'var(--pos-surface)',
                  color: 'var(--pos-ink)',
                  border: '1px solid var(--pos-line-strong)',
                  borderRadius: 'var(--pos-r-sm)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => startCheckout(tip)}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  background: 'var(--pos-accent)',
                  color: 'var(--pos-accent-contrast)',
                  border: 'none',
                  borderRadius: 'var(--pos-r-sm)',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('payTotal', { total: formatCurrency(amount + tip) })}
              </button>
            </>
          )}
          {isLocked && (
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '10px 18px',
                background: 'var(--pos-surface)',
                color: 'var(--pos-ink)',
                border: '1px solid var(--pos-line-strong)',
                borderRadius: 'var(--pos-r-sm)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('cancel')}
            </button>
          )}
          {state === 'failed' && (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 18px',
                  background: 'var(--pos-surface)',
                  color: 'var(--pos-ink)',
                  border: '1px solid var(--pos-line-strong)',
                  borderRadius: 'var(--pos-r-sm)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  padding: '10px 18px',
                  background: 'var(--pos-accent)',
                  color: 'var(--pos-accent-contrast)',
                  border: 'none',
                  borderRadius: 'var(--pos-r-sm)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('retry')}
              </button>
            </>
          )}
          {state === 'cancelled' && (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                background: 'var(--pos-accent)',
                color: 'var(--pos-accent-contrast)',
                border: 'none',
                borderRadius: 'var(--pos-r-sm)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t('cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
