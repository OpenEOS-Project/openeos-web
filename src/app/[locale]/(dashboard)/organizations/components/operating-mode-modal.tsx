'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banner, Icon } from '@openeos/ui';

import { CountrySelect } from '@/components/shared/country-select';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { adminOrganizationKeys } from '@/hooks/use-organizations';
import { adminApi } from '@/lib/api-client';
import { countryName } from '@/lib/countries';
import {
  OPERATING_MODE_REASON_MAX,
  getOperatingMode,
  operatingModeLabelValue,
  operatingModeOptions,
  operatingModeSwitchError,
  reasonError,
  type OperatingMode,
  type OperatingModeOrg,
} from '@/lib/operating-mode';
import type { Organization } from '@/types/organization';

interface OperatingModeModalProps {
  organization: Organization | null;
  onClose: () => void;
}

/**
 * Betriebsart und Land einer Organisation (nur Support / Super-Admin):
 * Betriebsart wechseln (gleiche Regeln wie für den Verein, `full` in
 * Deutschland nur mit TSE), Land ändern, Verläufe mit echten Namen. Jede
 * Änderung braucht einen Grund (Verlauf, Admin-Protokoll, Bescheinigung).
 */
export function OperatingModeModal({ organization, onClose }: OperatingModeModalProps) {
  const t = useTranslations('organizations.operatingMode');
  const tMode = useTranslations('operatingMode');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { formatDateTime } = useLocaleFormat();
  const queryClient = useQueryClient();
  const organizationId = organization?.id ?? '';

  const query = useQuery({
    queryKey: ['admin-operating-mode', organizationId],
    queryFn: async () => (await adminApi.getOperatingModeHistory(organizationId)).data,
    enabled: !!organizationId,
  });
  const state = query.data?.state;
  const org: OperatingModeOrg | null = state ?? organization;
  const current = getOperatingMode(org);
  const options = operatingModeOptions(org, state?.options);

  const [mode, setMode] = useState<OperatingMode | null>(null);
  const [modeReason, setModeReason] = useState('');
  const [country, setCountry] = useState('');
  const [countryReason, setCountryReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setMode(null);
    setModeReason('');
    setTouched(false);
  }, [organizationId, current, state?.operatingModeLegacy]);

  useEffect(() => {
    setCountry(state?.country ?? organization?.country ?? '');
    setCountryReason('');
  }, [organizationId, state?.country, organization?.country]);

  useEffect(() => {
    if (!organization) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [organization, onClose]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-operating-mode', organizationId] });
    queryClient.invalidateQueries({ queryKey: adminOrganizationKeys.lists() });
  };

  const saveMode = useMutation({
    mutationFn: async (next: OperatingMode) =>
      (await adminApi.setOperatingMode(organizationId, { mode: next, reason: modeReason.trim() })).data,
    onSuccess: (data) => {
      toast.success(t('saved', { mode: tMode(`names.${operatingModeLabelValue(data)}`) }));
      refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error, tCommon('error'))),
  });

  const saveCountry = useMutation({
    mutationFn: async () =>
      (await adminApi.setOrganizationCountry(organizationId, { country, reason: countryReason.trim() })).data,
    onSuccess: () => {
      toast.success(t('countrySaved', { country: countryName(country, locale) }));
      refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error, tCommon('error'))),
  });

  if (!organization) return null;

  const modeError = mode ? operatingModeSwitchError(org, mode, modeReason, state?.options) : 'unchanged';
  const countryError = !country || country === (state?.country ?? organization.country) ? 'unchanged' : reasonError(countryReason);
  const history = query.data?.history ?? [];
  const countryHistory = query.data?.countryHistory ?? [];
  const since = state?.operatingModeSince ?? organization.operatingModeSince;

  return (
    <div className="modal__overlay" style={{ display: 'flex' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel" role="dialog" aria-modal="true" aria-labelledby="operating-mode-title">
        <div className="modal__head">
          <h2 className="modal__title" id="operating-mode-title">
            {t('title', { name: organization.name })}
          </h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            {t('current')}: <b>{tMode(`names.${operatingModeLabelValue(org)}`)}</b>
            {since ? ` · ${t('since', { date: formatDateTime(since) })}` : ''}
            {' · '}
            {t('country')}: <b>{org?.country ? countryName(org.country, locale) : t('noCountry')}</b>
            {' · '}
            {t('tse')}: <b>{state?.tseActive ? t('tseActive') : t('tseInactive')}</b>
          </p>
          <Banner tone="info" icon={<Icon name="info" />}>
            {t('explain')}
          </Banner>

          {/* ── Betriebsart ── */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{t('modeTitle')}</h3>
            <fieldset
              aria-label={t('newMode')}
              style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {options.map((option) => {
                const isCurrent = option.mode === current;
                const disabled = !option.available || (isCurrent && !org?.operatingModeLegacy);
                return (
                  <label
                    key={option.mode}
                    style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, opacity: disabled && !isCurrent ? 0.6 : 1 }}
                  >
                    <input
                      type="radio"
                      name="admin-operating-mode"
                      value={option.mode}
                      checked={(mode ?? current) === option.mode}
                      disabled={disabled}
                      onChange={() => setMode(option.mode)}
                    />
                    <span>
                      {tMode(`names.${option.mode}`)}
                      {isCurrent && <span style={{ color: 'var(--ink-faint)' }}> ({t('currentShort')})</span>}
                      {!option.available && (
                        <span style={{ color: 'var(--ink-faint)' }}>
                          {' – '}
                          {tMode(`availability.${option.unavailableReason ?? 'tse_required'}`)}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600 }}>
              {t('reason')}
              <textarea
                className="input"
                rows={2}
                maxLength={OPERATING_MODE_REASON_MAX}
                value={modeReason}
                placeholder={t('reasonPlaceholder')}
                onChange={(e) => setModeReason(e.target.value)}
                onBlur={() => setTouched(true)}
                style={{ fontWeight: 400, resize: 'vertical' }}
              />
              <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>{t('reasonHint')}</span>
              {touched && mode && modeError === 'reasonTooShort' && (
                <span role="alert" style={{ fontWeight: 500, color: 'var(--red, var(--danger))' }}>
                  {t('reasonRequired')}
                </span>
              )}
            </label>
            <div>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!mode || !!modeError || saveMode.isPending}
                onClick={() => mode && saveMode.mutate(mode)}
              >
                {saveMode.isPending
                  ? tCommon('saving')
                  : mode
                    ? t('submit', { mode: tMode(`names.${mode}`) })
                    : t('submitEmpty')}
              </button>
            </div>
          </section>

          {/* ── Land ── */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{t('countryTitle')}</h3>
            <label className="auth-field" style={{ margin: 0 }}>
              <span>{t('newCountry')}</span>
              <CountrySelect value={country} onChange={setCountry} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600 }}>
              {t('reason')}
              <textarea
                className="input"
                rows={2}
                maxLength={OPERATING_MODE_REASON_MAX}
                value={countryReason}
                placeholder={t('reasonPlaceholder')}
                onChange={(e) => setCountryReason(e.target.value)}
                style={{ fontWeight: 400, resize: 'vertical' }}
              />
            </label>
            <div>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={!!countryError || saveCountry.isPending}
                onClick={() => saveCountry.mutate()}
              >
                {saveCountry.isPending ? tCommon('saving') : t('saveCountry')}
              </button>
            </div>
          </section>

          {history.length > 0 && (
            <div className="mode-history">
              <span className="mode-section__label">{t('history')}</span>
              <ul>
                {history.map((entry) => (
                  <li key={entry.id}>
                    <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                    <span>
                      {entry.fromMode
                        ? t('historyEntry', { from: tMode(`names.${entry.fromMode}`), to: tMode(`names.${entry.toMode}`) })
                        : tMode(`names.${entry.toMode}`)}
                      {entry.reason ? ` · ${entry.reason}` : ''}
                      {entry.changedByName ? ` · ${entry.changedByName}` : ''}
                      {entry.bySupport ? ` · ${t('bySupport')}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {countryHistory.length > 0 && (
            <div className="mode-history">
              <span className="mode-section__label">{t('countryHistory')}</span>
              <ul>
                {countryHistory.map((entry) => (
                  <li key={entry.id}>
                    <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                    <span>
                      {t('historyEntry', {
                        from: entry.fromValue ? countryName(entry.fromValue, locale) : '–',
                        to: countryName(entry.toValue, locale),
                      })}
                      {entry.reason ? ` · ${entry.reason}` : ''}
                      {entry.changedByName ? ` · ${entry.changedByName}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {tCommon('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
