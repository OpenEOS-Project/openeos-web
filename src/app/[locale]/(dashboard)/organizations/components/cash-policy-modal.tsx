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
import { OPERATING_MODE_REASON_MAX, OPERATING_MODE_REASON_MIN } from '@/lib/operating-mode';
import type { CashPolicyChange, Organization } from '@/types/organization';

interface CashPolicyModalProps {
  organization: Organization | null;
  onClose: () => void;
}

/**
 * Land und Bargeld-Regel einer Organisation (nur Support / Super-Admin).
 * Der Verein setzt sein Land nur einmal selbst und kann nur in Richtung
 * „Deutschland ohne Bargeld“ wechseln; alles andere geht hier, immer mit
 * Grund (Verlauf, Admin-Protokoll, Bescheinigung).
 */
export function CashPolicyModal({ organization, onClose }: CashPolicyModalProps) {
  const t = useTranslations('organizations.cashPolicy');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { formatDateTime } = useLocaleFormat();
  const queryClient = useQueryClient();
  const organizationId = organization?.id ?? '';

  const state = useQuery({
    queryKey: ['admin-cash-policy', organizationId],
    queryFn: async () => (await adminApi.getCashPolicyHistory(organizationId)).data,
    enabled: !!organizationId,
  });
  const current = state.data;

  const [country, setCountry] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    setCountry(current?.country ?? '');
    setReason('');
  }, [organizationId, current?.country]);

  useEffect(() => {
    if (!organization) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [organization, onClose]);

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-cash-policy', organizationId] });
    queryClient.invalidateQueries({ queryKey: adminOrganizationKeys.lists() });
    setReason('');
  };

  const saveCountry = useMutation({
    mutationFn: async () =>
      (await adminApi.setOrganizationCountry(organizationId, { country, reason: reason.trim() })).data,
    onSuccess: (data) => {
      toast.success(t('countrySaved', { country: countryName(data.country ?? '', locale) }));
      done();
    },
    onError: (error) => toast.error(apiErrorMessage(error, tCommon('error'))),
  });

  const saveLegacy = useMutation({
    mutationFn: async (legacy: boolean) =>
      (await adminApi.setCashPolicy(organizationId, { legacy, reason: reason.trim() })).data,
    onSuccess: () => {
      toast.success(t('policySaved'));
      done();
    },
    onError: (error) => toast.error(apiErrorMessage(error, tCommon('error'))),
  });

  if (!organization) return null;

  const reasonOk = reason.trim().length >= OPERATING_MODE_REASON_MIN;
  const pending = saveCountry.isPending || saveLegacy.isPending;
  const history = current?.history ?? [];
  const policyLabel = current?.cashPolicyLegacy
    ? t('policy.legacy')
    : current?.cashPolicy === 'blocked_de_no_tse'
      ? t('policy.blocked')
      : t('policy.allowed');

  const entryLabel = (entry: CashPolicyChange) =>
    entry.kind === 'country'
      ? t('historyCountry', { from: entry.fromValue ?? '–', to: entry.toValue })
      : t('historyPolicy', { from: entry.fromValue ?? '–', to: entry.toValue });

  return (
    <div className="modal__overlay" style={{ display: 'flex' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel" role="dialog" aria-modal="true" aria-labelledby="cash-policy-title">
        <div className="modal__head">
          <h2 className="modal__title" id="cash-policy-title">
            {t('title', { name: organization.name })}
          </h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            {t('currentCountry')}: <b>{current?.country ? countryName(current.country, locale) : t('noCountry')}</b>
            {' · '}
            {t('currentPolicy')}: <b>{policyLabel}</b>
          </p>
          <Banner tone="info" icon={<Icon name="info" />}>
            {t('explain')}
          </Banner>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600 }}>
            {t('reason')}
            <textarea
              className="input"
              rows={2}
              maxLength={OPERATING_MODE_REASON_MAX}
              value={reason}
              placeholder={t('reasonPlaceholder')}
              onChange={(e) => setReason(e.target.value)}
              style={{ fontWeight: 400, resize: 'vertical' }}
            />
            <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>{t('reasonHint')}</span>
          </label>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="auth-field" style={{ flex: '1 1 220px', margin: 0 }}>
              <span>{t('country')}</span>
              <CountrySelect value={country} onChange={setCountry} />
            </label>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!reasonOk || !country || country === current?.country || pending}
              onClick={() => saveCountry.mutate()}
            >
              {t('saveCountry')}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {current?.cashPolicyLegacy ? (
              <button
                type="button"
                className="btn btn--secondary"
                disabled={!reasonOk || pending}
                onClick={() => saveLegacy.mutate(false)}
              >
                {t('endLegacy')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--secondary"
                disabled={!reasonOk || pending}
                onClick={() => saveLegacy.mutate(true)}
              >
                {t('restoreLegacy')}
              </button>
            )}
          </div>

          {history.length > 0 && (
            <div className="cashless-history">
              <span className="cashless-history__title">{t('history')}</span>
              <ul>
                {history.map((entry) => (
                  <li key={entry.id}>
                    <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                    <span>
                      {entryLabel(entry)}
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
