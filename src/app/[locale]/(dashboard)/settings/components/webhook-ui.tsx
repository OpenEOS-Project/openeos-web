'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

import { useLocaleFormat } from '@/hooks/use-locale-format';

import {
  deliveryStatusTone,
  eventTypeMessageKey,
  webhookDuration,
  webhookEndpointStatus,
  webhookStatusTone,
} from '@/lib/webhooks';

import type {
  WebhookDeliveryError,
  WebhookDeliveryStatus,
  WebhookEndpoint,
  WebhookEventTypeInfo,
} from '@/types/webhook';

/**
 * Kleine Bausteine, die Liste, Dialoge und Zustellprotokoll der Webhooks
 * teilen: Statuspillen, Ereignisnamen, Fehlertexte, Dauer.
 */

export function WebhookStatusPill({
  endpoint,
}: {
  endpoint: Pick<WebhookEndpoint, 'active' | 'disabledReason' | 'consecutiveFailures' | 'failingSince'>;
}) {
  const t = useTranslations('settings.organizationWebhooks.status');
  const { formatDateTime } = useLocaleFormat();
  const status = webhookEndpointStatus(endpoint);
  let label: string;
  if (status === 'failing') {
    label = endpoint.failingSince
      ? t('failing', { date: formatDateTime(endpoint.failingSince) })
      : t('failingCount', { count: endpoint.consecutiveFailures });
  } else {
    label = t(status);
  }
  return (
    <span
      className={`badge badge--${webhookStatusTone(status)} webhook-pill`}
      data-status={status}
      title={status === 'failing' ? t('failingCount', { count: endpoint.consecutiveFailures }) : undefined}
    >
      {label}
    </span>
  );
}

export function DeliveryStatusPill({ status }: { status: WebhookDeliveryStatus }) {
  const t = useTranslations('settings.organizationWebhooks.deliveries.status');
  return (
    <span className={`badge badge--${deliveryStatusTone(status)} webhook-pill`} data-status={status}>
      {t(status)}
    </span>
  );
}

/**
 * Beschreibung eines Ereignistyps: in der Oberfläche übersetzt, sonst die
 * (deutsche) Beschreibung aus `GET /webhooks/info`, sonst der Code.
 */
export function useEventTypeLabel(eventTypes: readonly WebhookEventTypeInfo[] | undefined) {
  const t = useTranslations('settings.organizationWebhooks.eventTypes');
  return useCallback(
    (type: string): string => {
      const key = eventTypeMessageKey(type);
      if (t.has(key)) return t(key);
      return eventTypes?.find((info) => info.type === type)?.description ?? type;
    },
    [t, eventTypes]
  );
}

/** Fehlercode einer Zustellung als Satz; unbekannte Codes bleiben stehen. */
export function useDeliveryErrorLabel() {
  const t = useTranslations('settings.organizationWebhooks.deliveries.errors');
  return useCallback(
    (error: WebhookDeliveryError | string | null | undefined): string | null => {
      if (!error) return null;
      return t.has(error) ? t(error) : error;
    },
    [t]
  );
}

/** `123 ms` / `1,2 s` in der Sprache der Oberfläche, `—` ohne Wert. */
export function useDurationLabel() {
  const t = useTranslations('settings.organizationWebhooks.deliveries');
  const { formatNumber } = useLocaleFormat();
  return useCallback(
    (ms: number | null | undefined): string => {
      const duration = webhookDuration(ms);
      if (!duration) return '—';
      const value = formatNumber(duration.value);
      return duration.unit === 'ms' ? t('durationMs', { value }) : t('durationS', { value });
    },
    [t, formatNumber]
  );
}

/** Ereignis-Code in Monospace, Beschreibung als Tooltip. */
export function EventTypeCode({ type, label }: { type: string; label?: string }) {
  return (
    <code className="webhook-event-code" title={label}>
      {type}
    </code>
  );
}
