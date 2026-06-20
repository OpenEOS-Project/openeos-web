'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard01, CheckCircle, XCircle, Loading02 } from '@untitledui/icons';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';

type CheckoutState = 'initiating' | 'waiting' | 'success' | 'failed' | 'cancelled';

interface SumUpCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

const KNOWN_ERRORS = [
  'READER_BUSY',
  'READER_OFFLINE',
  'READER_NOT_FOUND',
  'INVALID_AMOUNT',
  'CHECKOUT_ALREADY_IN_PROGRESS',
] as const;

export function SumUpCheckoutModal({ isOpen, onClose, amount, onSuccess }: SumUpCheckoutModalProps) {
  const t = useTranslations('pos.sumupCheckout');
  const [state, setState] = useState<CheckoutState>('initiating');
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);

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
      setState('initiating');
      setError(null);
      return;
    }

    cancelledRef.current = false;

    const startCheckout = async () => {
      setState('initiating');
      setError(null);

      try {
        await deviceApi.initiateCheckout(amount);
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

    startCheckout();

    return () => {
      stopPolling();
    };
  }, [isOpen, amount]); // eslint-disable-line react-hooks/exhaustive-deps

  const startPolling = () => {
    stopPolling();

    pollingRef.current = setInterval(async () => {
      if (cancelledRef.current) {
        stopPolling();
        return;
      }

      try {
        const response = await deviceApi.getCheckoutStatus();
        const data = (response as { data?: { checkout?: { status?: string } } }).data;

        if (!data || cancelledRef.current) return;

        const checkoutStatus = data.checkout?.status;

        if (checkoutStatus === 'SUCCESSFUL' || checkoutStatus === 'successful') {
          stopPolling();
          setState('success');
          setTimeout(() => {
            onSuccess();
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

  const handleRetry = async () => {
    cancelledRef.current = false;
    setState('initiating');
    setError(null);

    try {
      await deviceApi.initiateCheckout(amount);
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
            {formatCurrency(amount)}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <p style={{ fontSize: 15, color: 'var(--pos-ink)', margin: 0, fontWeight: 500 }}>
              {message}
            </p>
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
