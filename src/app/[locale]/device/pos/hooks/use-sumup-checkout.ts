'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { deviceApi } from '@/lib/api-client';
import { ApiException } from '@/types/api';

/**
 * Kartenzahlung am SumUp-Lesegerät — Ablauf aus dem früheren
 * Kartenzahlungs-Dialog, ohne eigene Oberfläche (die liegt im
 * Kassieren-Blatt).
 *
 * `start(amount)` startet den Vorgang am Lesegerät und fragt alle 2 s den
 * Stand ab; nur bei `SUCCESSFUL` ruft der Hook `onSuccess`. `terminate`
 * geht nur an das Lesegerät, wenn hier wirklich ein Vorgang läuft —
 * früher ging bei jedem Laden der Kasse ein Abbruch an SumUp, der mit
 * 400 endete.
 */
export type SumupState = 'idle' | 'initiating' | 'waiting' | 'success' | 'failed' | 'cancelled';

const KNOWN_ERRORS = [
  'READER_BUSY',
  'READER_OFFLINE',
  'READER_NOT_FOUND',
  'INVALID_AMOUNT',
  'CHECKOUT_ALREADY_IN_PROGRESS',
] as const;

const POLL_MS = 2000;

export function useSumupCheckout(onSuccess: (info: { transactionId: string | null }) => void) {
  const t = useTranslations('pos.sumupCheckout');
  const apiErrorMessage = useApiErrorMessage();
  const [state, setState] = useState<SumupState>('idle');
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const txnRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const cancelledRef = useRef(false);
  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;

  const errorText = useCallback(
    (err: unknown) => {
      if (err instanceof ApiException && err.code === 'INTEGRATION_DISABLED') {
        return t('errors.INTEGRATION_DISABLED');
      }
      const message = err instanceof Error ? err.message : '';
      const known = KNOWN_ERRORS.find((code) => message.includes(code));
      if (known) return t(`errors.${known}`);
      return apiErrorMessage(err, t('failed'));
    },
    [apiErrorMessage, t],
  );

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const terminate = async () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    try {
      await deviceApi.terminateCheckout();
    } catch {
      // Lesegerät hatte keinen offenen Vorgang mehr.
    }
  };

  const poll = () => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      if (cancelledRef.current) {
        stopPolling();
        return;
      }
      try {
        const response = await deviceApi.getCheckoutStatus(txnRef.current ?? undefined);
        const status = (response as { data?: { checkout?: { status?: string } } }).data?.checkout?.status;
        if (!status || cancelledRef.current) return;
        const normalized = status.toUpperCase();
        if (normalized === 'SUCCESSFUL') {
          stopPolling();
          activeRef.current = false;
          setState('success');
          successRef.current({ transactionId: txnRef.current });
        } else if (normalized === 'FAILED') {
          stopPolling();
          activeRef.current = false;
          setState('failed');
          setError(t('failed'));
        } else if (normalized === 'CANCELLED') {
          stopPolling();
          activeRef.current = false;
          setState('cancelled');
        }
      } catch {
        // Einzelne Fehler beim Nachfragen ignorieren, weiter versuchen.
      }
    }, POLL_MS);
  };

  const start = async (amount: number) => {
    cancelledRef.current = false;
    activeRef.current = true;
    txnRef.current = null;
    setError(null);
    setState('initiating');
    try {
      const response = await deviceApi.initiateCheckout(amount);
      txnRef.current =
        (response as { data?: { data?: { client_transaction_id?: string } } })?.data?.data
          ?.client_transaction_id ?? null;
      if (cancelledRef.current) {
        await terminate();
        return;
      }
      setState('waiting');
      poll();
    } catch (err) {
      activeRef.current = false;
      if (cancelledRef.current) return;
      setState('failed');
      setError(errorText(err));
    }
  };

  const cancel = async () => {
    cancelledRef.current = true;
    stopPolling();
    setState('cancelled');
    await terminate();
  };

  const reset = () => {
    stopPolling();
    setError(null);
    setState('idle');
  };

  // Beim Verlassen (Blatt geschlossen) einen laufenden Vorgang beenden.
  useEffect(
    () => () => {
      stopPolling();
      if (activeRef.current) {
        cancelledRef.current = true;
        void terminate();
      }
    },
    [],
  );

  return {
    state,
    error,
    busy: state === 'initiating' || state === 'waiting',
    start,
    cancel,
    reset,
  };
}
