'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';

import { useAuthStore } from '@/stores/auth-store';

/**
 * ID der aktuellen Organisation mit Kopierknopf.
 *
 * API-Zugänge und Webhooks arbeiten mit REST-Pfaden wie
 * `/api/organizations/{id}/webhooks` — die ID stand bisher nirgends in der
 * Oberfläche. Sie ist kein Geheimnis (ohne Token nutzt sie niemandem) und
 * steht deshalb auch für Mitglieder ohne Admin-Recht da.
 */
export function OrganizationIdField({ example }: { example: 'tokens' | 'webhooks' }) {
  const t = useTranslations('settings.organizationId');
  const organizationId = useAuthStore((state) => state.currentOrganization?.organizationId);
  const [copied, setCopied] = useState(false);
  if (!organizationId) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(organizationId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Zwischenablage gesperrt: die ID steht markierbar daneben.
    }
  };

  const path = example === 'webhooks' ? `/api/organizations/${organizationId}/webhooks` : `/api/organizations/${organizationId}/events`;

  return (
    <div className="org-id" data-testid="organization-id">
      <span className="org-id__label" id="org-id-label">{t('label')}</span>
      <span className="org-id__row">
        <code className="org-id__value" aria-labelledby="org-id-label">{organizationId}</code>
        <button
          type="button"
          className="btn btn--ghost org-id__copy"
          onClick={() => void copy()}
          aria-label={copied ? t('copied') : t('copy')}
          title={copied ? t('copied') : t('copy')}
          data-testid="organization-id-copy"
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span>{copied ? t('copied') : t('copy')}</span>
        </button>
      </span>
      <span className="org-id__hint">
        {t.rich('hint', { path: () => <code>{path}</code> })}
      </span>
    </div>
  );
}
