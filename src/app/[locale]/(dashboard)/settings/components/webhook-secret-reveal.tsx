'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Banner, Icon } from '@openeos/ui';

import { toast } from '@/components/shared/toast';

import { useLocaleFormat } from '@/hooks/use-locale-format';

import type { WebhookEndpointWithSecret } from '@/types/webhook';

/**
 * Einmalige Anzeige des Secrets nach dem Anlegen und nach dem Erneuern —
 * dasselbe Muster wie beim Klartext eines Zugangs. Schließen geht nur über
 * „Fertig“ im Dialog, der diesen Inhalt zeigt.
 */
export function WebhookSecretReveal({ endpoint }: { endpoint: WebhookEndpointWithSecret }) {
  const t = useTranslations('settings.organizationWebhooks.secret');
  const { formatDateTime } = useLocaleFormat();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(endpoint.secret);
      setCopied(true);
      setError(null);
      toast.success(t('copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('copyFailed'));
    }
  };

  return (
    <div className="api-token-reveal">
      <Banner tone="warn" icon={<Icon name="alert" />} title={t('onceTitle')}>
        {t('onceText')}
      </Banner>

      <div className="api-token-reveal__secret">
        <code data-testid="webhook-secret">{endpoint.secret}</code>
        <button
          type="button"
          className={`btn btn--icon btn--sm ${copied ? 'btn--primary' : 'btn--ghost'}`}
          onClick={onCopy}
          title={copied ? t('copied') : t('copy')}
          aria-label={copied ? t('copied') : t('copy')}
        >
          <Icon name={copied ? 'check' : 'copy'} size={16} />
        </button>
        <span className="oe-sr-only" aria-live="polite">
          {copied ? t('copied') : ''}
        </span>
      </div>

      {error && (
        <p className="auth-field__error" role="alert">
          {error}
        </p>
      )}

      <p className="api-token-reveal__meta webhook-reveal__url">{endpoint.url}</p>
      {endpoint.previousSecretExpiresAt && (
        <p className="api-token-form__hint">
          {t('previousValid', { date: formatDateTime(endpoint.previousSecretExpiresAt) })}
        </p>
      )}
    </div>
  );
}
