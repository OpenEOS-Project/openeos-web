'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import { ToggleSwitch } from '@/components/shared/toggle-switch';
import { useIntegrationErrorMessage, useSetIntegrationEnabled } from '@/hooks/use-integrations';
import { useCreateTse, type useTseSetup } from '@/hooks/use-tse';
import { ApiException } from '@/types/api';
import { reasonError } from '@/lib/operating-mode';
import { isMonthlyDeactivation, shortSerial, type TseSetupStep } from '@/lib/tse';
import type { TseMasterDataField, TseStatus } from '@/types/tse';

import { TseChecklist } from './tse-checklist';
import { TseMasterDataForm } from './tse-master-data-form';
import { TseStepHint } from './tse-step-hint';

interface TseSetupCardProps {
  organizationId: string;
  status: TseStatus;
  setup: ReturnType<typeof useTseSetup> & { step: TseSetupStep };
}

/**
 * Einrichtung der Cloud-TSE, solange keine aktiv ist: oben der konkrete
 * Grund, an dem es gerade hängt, mit der Aktion dazu (Land festlegen,
 * Veranstaltung freischalten, …), darunter die Checkliste aller
 * Voraussetzungen (✓ erfüllt, • offen), „Jetzt einrichten“ bzw. der
 * Hinweis auf die automatische Anlage am ersten Veranstaltungstag, der
 * Fortschritt während der Anlage und ein gescheiterter Versuch. Der
 * Support kann Veranstaltung und Monat mit Grund übergehen.
 */
export function TseSetupCard({ organizationId, status, setup }: TseSetupCardProps) {
  const { step } = setup;
  const t = useTranslations('integrations.tse.setup');
  const tCommon = useTranslations('common');
  const tIntegrations = useTranslations('integrations');
  const toggle = useSetIntegrationEnabled();
  const integrationErrorMessage = useIntegrationErrorMessage();
  const { formatDate, formatDateTime } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const { isSuperAdmin } = usePermissions();
  const create = useCreateTse(organizationId);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reason, setReason] = useState('');
  // 409 TSE_MASTER_DATA_REQUIRED beim Anlegen (Status war noch nicht neu geladen).
  const [missingFromCreate, setMissingFromCreate] = useState<TseMasterDataField[] | null>(null);

  const unit = status.unit;
  const canCreate =
    status.eligibility.ok && missingFromCreate === null && (step === 'ready' || step === 'failed');
  const showOverride =
    isSuperAdmin && setup.input.integrationEnabled && (step === 'paid_event_required' || step === 'too_early');
  // Vor Server, Land und Schalter ist „Jetzt einrichten“ kein Thema.
  const showCreate = step !== 'unavailable' && step !== 'country_missing' && step !== 'country' && step !== 'integration_disabled';
  // Stammdaten-Formular: wenn die API sie anmahnt (oder das Anlegen mit 409 scheiterte).
  const needsMasterData = step === 'master_data' || missingFromCreate !== null;
  const missing: TseMasterDataField[] =
    missingFromCreate ?? (setup.input.masterDataMissing.length > 0 ? setup.input.masterDataMissing : ['taxNumber', 'street', 'zip', 'city']);
  const reasonProblem = reasonError(reason);

  const enableSwitch = (
    <label className="tse-hint__switch">
      <ToggleSwitch
        checked={setup.input.integrationEnabled}
        disabled={toggle.isPending}
        onChange={(checked) =>
          toggle.mutate(
            { id: 'tse', enabled: checked },
            {
              onError: (error) =>
                toast.error(integrationErrorMessage(error, tIntegrations('errors.toggleFailed'))),
            },
          )
        }
      />
      <span>{tIntegrations('tse.hint.integrationDisabled.action')}</span>
    </label>
  );

  const start = (override = false) => {
    create.mutate(override ? { override: true, reason: reason.trim() } : {}, {
      onSuccess: () => {
        toast.success(t('started'));
        setOverrideOpen(false);
        setReason('');
      },
      onError: (error) => {
        if (error instanceof ApiException && (error.reason ?? error.code) === 'TSE_MASTER_DATA_REQUIRED') {
          const raw = error.params?.missing;
          const list = typeof raw === 'string' ? raw.split(',').map((v) => v.trim()).filter(Boolean) : [];
          setMissingFromCreate((list.length > 0 ? list : ['taxNumber', 'street', 'zip', 'city']) as TseMasterDataField[]);
        }
        toast.error(apiErrorMessage(error, t('failedToStart')));
      },
    });
  };

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
        {unit?.state === 'failed' && (
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

        {unit?.state === 'deactivated' && (
          <Banner tone="info" icon={<Icon name="info" />} title={t('deactivated.title')}>
            {t(isMonthlyDeactivation(unit.deactivationReason) ? 'deactivated.monthly' : 'deactivated.text', {
              serial: shortSerial(unit.serialNumber),
              date: formatDate(unit.deactivatedAt),
            })}
          </Banner>
        )}

        {/* Ein Fehlschlag hat oben schon sein eigenes Banner. */}
        {step !== 'failed' && (
          <TseStepHint
            step={step}
            eventCheck={setup.eventCheck}
            unlockEvent={setup.unlockEvent}
            variant="banner"
            // „Jetzt einrichten“ und die Stammdaten stehen unten.
            actions={{ enable: enableSwitch, master_data: null, setup: null, retry: null }}
          />
        )}

        <TseChecklist requirements={setup.requirements} input={setup.input} step={step} />

        {needsMasterData && (
          <TseMasterDataForm
            organizationId={organizationId}
            missing={missing}
            onSaved={() => setMissingFromCreate(null)}
          />
        )}

        {showCreate && (
          <>
            {/* Bei „bereit“ sagt der Hinweis oben das schon. */}
            {step !== 'ready' && (
              <p className="tse-auto" data-testid="tse-auto-note">
                <Icon name="clock" size={16} />
                <span>{t('autoNote')}</span>
              </p>
            )}

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
          </>
        )}

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
