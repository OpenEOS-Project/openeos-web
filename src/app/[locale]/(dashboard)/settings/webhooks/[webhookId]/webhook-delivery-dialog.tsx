'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Banner, Icon, Skeleton } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useRedeliverWebhookDelivery, useWebhookDelivery, useWebhookInfo } from '@/hooks/use-webhooks';

import { prettyJson } from '@/lib/webhooks';

import type { WebhookDelivery } from '@/types/webhook';

import {
  DeliveryStatusPill,
  EventTypeCode,
  useDeliveryErrorLabel,
  useDurationLabel,
  useEventTypeLabel,
} from '../../components/webhook-ui';

interface WebhookDeliveryDialogProps {
  organizationId: string;
  webhookId: string;
  /** Eintrag aus der Liste — steht sofort, die Details laden nach. */
  delivery: WebhookDelivery;
  redeliverDisabled?: boolean;
  onClose: () => void;
  onRedelivered: () => void;
}

/**
 * Eine Zustellung im Detail: Eckdaten, Versuche, der gesendete Inhalt
 * (eingerückt) und die Antwort des Empfängers (erste 1 KB). „Erneut senden“
 * legt eine neue Zustellung mit derselben Ereignis-Id an.
 */
export function WebhookDeliveryDialog({
  organizationId,
  webhookId,
  delivery,
  redeliverDisabled,
  onClose,
  onRedelivered,
}: WebhookDeliveryDialogProps) {
  const t = useTranslations('settings.organizationWebhooks.deliveries');
  const tDetail = useTranslations('settings.organizationWebhooks.deliveries.detail');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { locale } = useLocaleFormat();
  const detail = useWebhookDelivery(organizationId, webhookId, delivery.id);
  const redeliver = useRedeliverWebhookDelivery(organizationId, webhookId);
  const info = useWebhookInfo(organizationId);
  const eventLabel = useEventTypeLabel(info.data?.eventTypes);
  const errorLabel = useDeliveryErrorLabel();
  const durationLabel = useDurationLabel();
  const [copied, setCopied] = useState(false);

  const pending = redeliver.isPending;
  const close = pending ? () => {} : onClose;

  useEffect(() => {
    if (pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending, onClose]);

  // Sekundengenau: im Protokoll liegen Versuche oft nur Sekunden auseinander.
  const formatPrecise = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return (value: string | null | undefined) => (value ? format.format(new Date(value)) : '—');
  }, [locale]);

  const current = detail.data ?? delivery;
  const payload = detail.data ? prettyJson(detail.data.payload) : null;
  const error = errorLabel(current.error);

  const onRedeliver = () => {
    redeliver.mutate(delivery.id, {
      onSuccess: () => {
        toast.success(tDetail('redelivered'));
        onRedelivered();
      },
      onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
    });
  };

  const onCopy = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Markieren und kopieren geht immer noch von Hand.
    }
  };

  const facts: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: tDetail('status'), value: <DeliveryStatusPill status={current.status} /> },
    { label: tDetail('http'), value: current.responseStatus ?? '—', mono: true },
    { label: tDetail('duration'), value: durationLabel(current.durationMs) },
    {
      label: tDetail('attempts'),
      value: t('attempts', { attempts: current.attempts, max: current.maxAttempts }),
    },
    { label: tDetail('created'), value: formatPrecise(current.createdAt) },
    { label: tDetail('lastAttempt'), value: formatPrecise(current.lastAttemptAt) },
    ...(current.nextAttemptAt ? [{ label: tDetail('nextAttempt'), value: formatPrecise(current.nextAttemptAt) }] : []),
    ...(error ? [{ label: tDetail('error'), value: <span className="webhook-deliveries__error">{error}</span> }] : []),
    { label: tDetail('eventId'), value: current.eventId, mono: true },
    { label: tDetail('deliveryId'), value: current.id, mono: true },
    ...(current.redeliveryOf ? [{ label: tDetail('redeliveryOf'), value: current.redeliveryOf, mono: true }] : []),
  ];

  return (
    <div className="modal__overlay" onClick={close}>
      <ModalPanel titleId="webhook-delivery-title" className="modal__panel--xl">
        <div className="modal__head">
          <h2 id="webhook-delivery-title" className="webhook-delivery__title">
            {tDetail('title')} <EventTypeCode type={current.eventType} />
          </h2>
          <DialogCloseButton onClick={close} />
        </div>

        <div className="modal__body webhook-delivery">
          <p className="api-tokens__count">{eventLabel(current.eventType)}</p>

          <dl className="webhook-facts webhook-facts--grid">
            {facts.map((fact) => (
              <div key={fact.label} className="webhook-facts__row">
                <dt>{fact.label}</dt>
                <dd className={fact.mono ? 'webhook-mono' : undefined}>{fact.value}</dd>
              </div>
            ))}
          </dl>

          {detail.isLoading ? (
            <Skeleton height={200} />
          ) : detail.isError || !detail.data ? (
            <Banner tone="danger" icon={<Icon name="alert" />}>
              {apiErrorMessage(detail.error, tDetail('loadError'))}
            </Banner>
          ) : (
            <>
              <section className="webhook-delivery__section">
                <h3>{tDetail('attemptLog')}</h3>
                {detail.data.attemptLog.length === 0 ? (
                  <p className="webhook-muted">{tDetail('noAttempts')}</p>
                ) : (
                  <ol className="webhook-attempts">
                    {detail.data.attemptLog.map((attempt, index) => (
                      <li key={`${attempt.at}-${index}`}>
                        <span className="webhook-attempts__n">{index + 1}.</span>
                        <span className="webhook-num">{formatPrecise(attempt.at)}</span>
                        <span className="webhook-mono">{attempt.responseStatus ?? '—'}</span>
                        <span className="webhook-num">{durationLabel(attempt.durationMs)}</span>
                        {attempt.error && (
                          <span className="webhook-deliveries__error">{errorLabel(attempt.error)}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="webhook-delivery__section">
                <div className="webhook-delivery__section-head">
                  <h3>{tDetail('payload')}</h3>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={onCopy}>
                    <Icon name={copied ? 'check' : 'copy'} size={14} />
                    {copied ? tDetail('copied') : tDetail('copyPayload')}
                  </button>
                </div>
                <pre className="webhook-code" data-testid="webhook-payload">
                  {payload}
                </pre>
              </section>

              <section className="webhook-delivery__section">
                <h3>
                  {tDetail('response')} <span className="webhook-muted">({tDetail('responseHint')})</span>
                </h3>
                {detail.data.responseBody ? (
                  <pre className="webhook-code webhook-code--response">{prettyJson(detail.data.responseBody)}</pre>
                ) : (
                  <p className="webhook-muted">{tDetail('noResponse')}</p>
                )}
              </section>
            </>
          )}
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={pending}>
            {tCommon('close')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onRedeliver}
            disabled={pending || redeliverDisabled}
          >
            <Icon name="send" size={16} />
            {pending ? tDetail('redelivering') : tDetail('redeliver')}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}

