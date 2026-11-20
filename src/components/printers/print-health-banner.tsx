'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { usePermissions } from '@/hooks/use-permissions';
import { usePrintHealth } from '@/hooks/use-printers';
import { Link } from '@/i18n/routing';
import { joinPrinterNames, printHealthNotice } from '@/lib/print-health';

/**
 * Hinweis, wenn Bons nicht gedruckt werden: Agent oder Drucker offline,
 * Bons warten länger als 30 s oder sind fehlgeschlagen. Im Dashboard mit
 * Link zur Druckerseite (nur wer Geräte verwalten darf), auf der
 * Druckerseite selbst ohne.
 *
 * Bleibt still, solange alles druckt oder der Zustand nicht geladen werden
 * kann — ein Fehler hier soll die Seite nicht stören.
 */
export function PrintHealthBanner({
  organizationId,
  showLink = false,
  live = true,
  className,
}: {
  organizationId: string;
  className?: string;
  showLink?: boolean;
  /** Eigene Socket-Verbindung; die Druckerseite hat schon eine. */
  live?: boolean;
}) {
  const t = useTranslations('printHealth');
  const locale = useLocale();
  const { hasPermission } = usePermissions();
  const { data: health } = usePrintHealth(organizationId, { live });
  const notice = printHealthNotice(health);
  if (!notice) return null;

  const printers = joinPrinterNames(notice.printers, locale);
  const agents = joinPrinterNames(notice.agents, locale);
  const title = t(`title.${notice.kind}`, {
    printers,
    count: notice.kind === 'failed' ? notice.failedJobs : notice.waitingJobs,
  });

  const body: string[] = [];
  if (notice.kind === 'offlineWaiting' || notice.kind === 'agentOffline') {
    body.push(agents ? t('body.agentOffline', { agents }) : t('body.agentOfflineUnnamed'));
  } else if (notice.kind === 'printerOffline') {
    body.push(t('body.printerOffline'));
  } else if (notice.kind === 'waiting') {
    body.push(t('body.waiting'));
  }
  if (notice.kind === 'offlineWaiting' || notice.kind === 'waiting') {
    body.push(t('body.autoResend'));
  }
  if (notice.failedJobs > 0) {
    body.push(
      t('body.failed', { count: notice.failedJobs, minutes: notice.failedWindowMinutes }),
    );
  }

  return (
    <div
      className={['oe-banner', `oe-banner--${notice.tone}`, 'print-health-banner', className]
        .filter(Boolean)
        .join(' ')}
      role={notice.tone === 'danger' ? 'alert' : 'status'}
      data-testid="print-health-banner"
    >
      <span className="oe-banner__ico">
        <Icon name="printer" />
      </span>
      <div className="print-health-banner__content">
        <b>{title}</b>
        {body.length > 0 && <span>{body.join(' ')}</span>}
        {showLink && hasPermission('devices') && (
          <Link href="/printers" className="notice-link">
            {t('link')}
          </Link>
        )}
      </div>
    </div>
  );
}
