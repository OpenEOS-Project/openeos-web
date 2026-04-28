'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard01, CheckCircle, XCircle, Loading02 } from '@untitledui/icons';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Button } from '@/components/ui/buttons/button';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';

type CheckoutState = 'initiating' | 'waiting' | 'success' | 'failed' | 'cancelled';

interface SumUpCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

// Known SumUp error types that have i18n translations
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

  /** Map API error to user-friendly message */
  const getErrorMessage = (err: unknown): string => {
    const message = err instanceof Error ? err.message : '';
    // Check if the error message matches a known SumUp error type
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
      // Ignore termination errors — reader may not have an active checkout
    }
  };

  // Start checkout when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Cleanup on close — always attempt to terminate reader
      stopPolling();
      if (cancelledRef.current) {
        // Already terminated via handleCancel
      } else {
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
          // Cancel happened while initiateCheckout was in-flight — terminate now
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
  }, [isOpen, amount]);

  const startPolling = () => {
    stopPolling();

    pollingRef.current = setInterval(async () => {
      if (cancelledRef.current) {
        stopPolling();
        return;
      }

      try {
        const response = await deviceApi.getCheckoutStatus();
        const data = (response as any).data;

        if (!data || cancelledRef.current) return;

        // Checkout status (if present in response)
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
        // Otherwise keep polling (WAITING_FOR_CARD, WAITING_FOR_PIN, etc.)
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

    // Always call terminate — the SumUp API ignores it if no checkout is active
    await terminateReader();

    setTimeout(() => {
      onClose();
    }, 500);
  };

  const getIcon = () => {
    switch (state) {
      case 'success':
        return <CheckCircle className="h-12 w-12 text-success-primary" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="h-12 w-12 text-error-primary" />;
      default:
        return <CreditCard01 className="h-12 w-12 text-brand-primary" />;
    }
  };

  const getMessage = () => {
    switch (state) {
      case 'initiating':
        return t('processing');
      case 'waiting':
        return t('waiting');
      case 'success':
        return t('success');
      case 'failed':
        return error || t('failed');
      case 'cancelled':
        return t('cancelled');
    }
  };

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={state === 'waiting' || state === 'initiating' ? () => {} : onClose}
      title={t('title')}
    >
      <div className="px-6 py-8">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Icon */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
            {getIcon()}
          </div>

          {/* Amount */}
          <p className="text-3xl font-bold text-primary">
            {formatCurrency(amount)}
          </p>

          {/* Status Message */}
          <div className="space-y-2">
            <p className="text-lg text-primary">{getMessage()}</p>
            {(state === 'initiating' || state === 'waiting') && (
              <Loading02 className="mx-auto h-6 w-6 animate-spin text-tertiary" />
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3 border-t border-secondary px-6 py-4">
        {(state === 'initiating' || state === 'waiting') && (
          <Button color="secondary" onClick={handleCancel}>
            {t('cancel')}
          </Button>
        )}
        {state === 'failed' && (
          <>
            <Button color="secondary" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button onClick={handleRetry}>
              {t('retry')}
            </Button>
          </>
        )}
        {state === 'cancelled' && (
          <Button onClick={onClose}>
            {t('cancel')}
          </Button>
        )}
      </div>
    </DialogModal>
  );
}
