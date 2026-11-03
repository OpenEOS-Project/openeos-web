'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import { useCreateTse } from '@/hooks/use-tse';
import { Link } from '@/i18n/routing';
import { reasonError } from '@/lib/operating-mode';
import { shortSerial, type TseSetupStep } from '@/lib/tse';
import type { TseStatus } from '@/types/tse';

interface TseSetupCardProps {
  organizationId: string;
  status: TseStatus;
  step: TseSetupStep;
}

/**
 * Einrichtung der Cloud-TSE, solange keine aktiv ist: Voraussetzungen
 * (Deutschland, bezahlte Veranstaltung, frühestens im Monat ihres
 * Beginns), „Jetzt einrichten“ bzw. der Hinweis auf die automatische
 * Anlage am ersten Veranstaltungstag, der Fortschritt während der Anlage
 * und ein gescheiterter Versuch. Der Support kann die Bedingungen mit
 * Grund übergehen.
 */
export function TseSetupCard({ organizationId, status, step }: TseSetupCardProps) {
  const t = useTranslations('integrations.tse.setup');
  const tCommon = useTranslations('common');
  const { formatDate, formatDateTime } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const { isSuperAdmin } = usePermissions();
  const create = useCreateTse(organizationId);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reason, setReason] = useState('');

  const unit = status.unit;
  const event = status.eligibility.event;
  const isGermany = (status.country ?? '').toUpperCase() === 'DE';
  const hasPaidEvent = step !== 'paid_event_required' && !!event;
  const inMonth = step !== 'too_early' && hasPaidEvent;
  const canCreate = status.eligibility.ok && (step === 'ready' || step === 'failed' || step === 'deactivated');
  const showOverride = isSuperAdmin && (step === 'paid_event_required' || step === 'too_early');
  const reasonProblem = reasonError(reason);

  const start = (override = false) => {
    create.mutate(override ? { override: true, reason: reason.trim() } : {}, {
      onSuccess: () => {
        toast.success(t('started'));
        setOverrideOpen(false);
        setReason('');
      },
      onError: (error) => toast.error(apiErrorMessage(error, t('failedToStart'))),
    });
  };

  if (step === 'unavailable' || step === 'country') {
    return (
      <div className="app-card" data-testid="tse-setup" data-step={step}>
        <SettingsSectionHead icon="shield-check" title={t('title')} description={t('description')} />
        <Banner tone="info" icon={<Icon name="info" />} title={t(`${step}.title`)}>
          {t(`${step}.text`)}
        </Banner>
      </div>
    );
  }

  if (step === 'creating') {
    return (
      <div className="app-card" data-testid="tse-setup" data-step={step}>
        <SettingsSectionHead icon="shield-check" title={t('title')} description={t('description')} />
        <div className="tse-progress" role="status" aria-live="polite">
          <span className="tse-spinner" aria-hidden="true" />
          <div>
            <b>{t('creating.title')}</b>
            <p>{t('creating.text')}</p>
            {unit?.lastError && (
              <p className="tse-muted">
                {t('creating.retrying', { code: unit.lastError.code, time: formatDateTime(unit.lastError.at) })}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-card" data-testid="tse-setup" data-step={step}>
      <SettingsSectionHead icon="shield-check" title={t('title')} description={t('description')} />

      <div className="tse-setup">
        {step === 'failed' && unit && (
          <Banner tone="danger" icon={<Icon name="alert" />} title={t('failed.title')}>
            {t('failed.text', { date: formatDateTime(unit.failedAt ?? unit.createdAt) })}
            {unit.lastError && (
              <>
                {' '}
                <span className="tse-mono">
                  {unit.lastError.code}
                  {unit.lastError.message ? ` – ${unit.lastError.message}` : ''}
                </span>
              </>
            )}
          </Banner>
        )}

        {step === 'deactivated' && unit && (
          <Banner tone="info" icon={<Icon name="info" />} title={t('deactivated.title')}>
            {t('deactivated.text', {
              serial: shortSerial(unit.serialNumber),
              date: formatDate(unit.deactivatedAt),
            })}
          </Banner>
        )}

        <ul className="tse-checklist" aria-label={t('requirements')}>
          <Requirement ok={isGermany} label={t('check.country')} />
          <Requirement
            ok={hasPaidEvent}
            label={
              hasPaidEvent && event
                ? t('check.paidEventNamed', { name: event.name, date: formatDate(event.startDate) })
                : t('check.paidEvent')
            }
            action={
              !hasPaidEvent ? (
                <Link href="/events" className="notice-link">
                  {t('check.toEvents')}
                </Link>
              ) : undefined
            }
          />
          <Requirement
            ok={inMonth}
            pending={step === 'too_early'}
            label={
              step === 'too_early' && status.eligibility.availableFrom
                ? t('check.monthFrom', { date: formatDate(status.eligibility.availableFrom) })
                : t('check.month')
            }
          />
        </ul>

        {step === 'paid_event_required' && <p className="tse-text">{t('paidEventRequired')}</p>}
        {step === 'too_early' && status.eligibility.availableFrom && (
          <p className="tse-text">
            {t('tooEarly', {
              date: formatDate(status.eligibility.availableFrom),
              name: event?.name ?? '',
            })}
          </p>
        )}

        <p className="tse-auto" data-testid="tse-auto-note">
          <Icon name="clock" size={16} />
          <span>{t('autoNote')}</span>
        </p>

        <div className="tse-setup__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canCreate || create.isPending}
            onClick={() => start(false)}
            data-testid="tse-create"
          >
            {create.isPending ? t('starting') : step === 'failed' ? t('retry') : t('createNow')}
          </button>
          {!canCreate && <span className="tse-muted">{t('createDisabled')}</span>}
          {canCreate && <span className="tse-muted">{t('costNote')}</span>}
        </div>

        {showOverride && (
          <div className="tse-override">
            {!overrideOpen ? (
              <button type="button" className="btn btn--ghost" onClick={() => setOverrideOpen(true)}>
                <Icon name="lock" />
                {t('override.open')}
              </button>
            ) : (
              <div className="tse-override__form">
                <b>{t('override.title')}</b>
                <p className="tse-muted">{t('override.text')}</p>
                <label className="auth-field">
                  <span className="auth-field__label">{t('override.reason')}</span>
                  <textarea
                    className="input"
                    rows={2}
                    value={reason}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t('override.placeholder')}
                  />
                </label>
                <div className="tse-setup__actions">
                  <button type="button" className="btn btn--ghost" onClick={() => setOverrideOpen(false)}>
                    {tCommon('cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    disabled={!!reasonProblem || create.isPending}
                    onClick={() => start(true)}
                    data-testid="tse-override-create"
                  >
                    {t('override.submit')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Requirement({
  ok,
  pending,
  label,
  action,
}: {
  ok: boolean;
  pending?: boolean;
  label: string;
  action?: React.ReactNode;
}) {
  const tone = ok ? 'ok' : pending ? 'pending' : 'missing';
  return (
    <li className={`tse-check tse-check--${tone}`}>
      <span className="tse-check__icon" aria-hidden="true">
        <Icon name={ok ? 'check' : pending ? 'clock' : 'x'} size={14} />
      </span>
      <span className="tse-check__label">{label}</span>
      {action}
    </li>
  );
}
