'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@openeos/ui';

import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { Link } from '@/i18n/routing';
import { organizationsApi } from '@/lib/api-client';
import { getOperatingMode, orderOnlyDocsUrl } from '@/lib/operating-mode';
import type { OrganizationSettings } from '@/types/organization';

interface OperatingModeInfoProps {
  organizationId: string;
  settings: OrganizationSettings | undefined;
  isAdmin: boolean;
}

/**
 * Betriebsart der Organisation (nur lesend): Kasse oder „Nur Bestellen“.
 * Umschalten kann nur der OpenEOS-Support — sonst wäre die Organisation
 * nicht TSE-frei. Im Modus „Nur Bestellen“ laden Admins hier die
 * Herstellerbescheinigung für die Verfahrensdokumentation herunter.
 */
export function OperatingModeInfo({ organizationId, settings, isAdmin }: OperatingModeInfoProps) {
  const t = useTranslations('settings.organizationPayments.operatingMode');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { formatDate, formatDateTime } = useLocaleFormat();
  const [downloading, setDownloading] = useState(false);

  const mode = getOperatingMode(settings);
  const orderOnly = mode === 'order_only';
  const since = settings?.operatingModeSince;

  const state = useQuery({
    queryKey: ['operating-mode', organizationId],
    queryFn: async () => (await organizationsApi.getOperatingMode(organizationId)).data,
    enabled: !!organizationId,
  });
  const history = state.data?.history ?? [];

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await organizationsApi.operatingModeCertificate(organizationId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openeos-herstellerbescheinigung-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('certificateFailed')));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className={orderOnly ? 'operating-mode is-order-only' : 'operating-mode'} aria-label={t('title')}>
      <div className="operating-mode__head">
        <span className="operating-mode__label">{t('title')}</span>
        <b className="operating-mode__value">{t(`modes.${mode}`)}</b>
        {orderOnly && since && <span className="operating-mode__since">{t('since', { date: formatDate(since) })}</span>}
      </div>
      <p className="operating-mode__text">{orderOnly ? t('orderOnlyText') : t('posText')}</p>

      {orderOnly && (
        <div className="operating-mode__cert">
          <p>{isAdmin ? t('certificateHint') : t('certificateAdminOnly')}</p>
          {isAdmin && (
            <button type="button" className="btn btn--secondary" onClick={() => void download()} disabled={downloading}>
              <Icon name="download" />
              {t('certificate')}
            </button>
          )}
        </div>
      )}

      <p className="operating-mode__request">
        {t('request')}{' '}
        <Link href="/support" className="cash-tse-notice__link">
          {t('supportLink')}
        </Link>
        {' · '}
        <a href={orderOnlyDocsUrl(locale)} target="_blank" rel="noreferrer" className="cash-tse-notice__link">
          {t('docsLink')}
        </a>
      </p>

      {history.length > 0 && (
        <div className="cashless-history">
          <span className="cashless-history__title">{t('historyTitle')}</span>
          <ul>
            {history.map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                <span>
                  {t('historyEntry', { from: t(`modes.${entry.fromMode}`), to: t(`modes.${entry.toMode}`) })}
                  {entry.reason ? ` · ${entry.reason}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
