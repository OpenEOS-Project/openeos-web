'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useUpdateCurrentOrganizationSettings } from '@/hooks/use-organizations';
import { isValidTaxNumber, isValidVatId, missingMasterData, normalizeVatId } from '@/lib/dsfinvk';
import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationSettings } from '@/types/organization';

import { SettingsSectionHead } from './settings-section-head';

/**
 * Steuerangaben der Organisation: offizieller Name, Steuernummer und
 * USt-IdNr. Sie stehen im DSFinV-K-Export (Stamm_Abschluss) — für die
 * Cloud-TSE in Deutschland braucht es Steuernummer oder USt-IdNr. und die
 * Anschrift (Reiter „Kontakt“).
 */
export function OrganizationTaxSection() {
  const t = useTranslations('settings.organizationTax');
  const apiErrorMessage = useApiErrorMessage();
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organization = currentOrganization?.organization;
  const settings = (organization?.settings ?? {}) as OrganizationSettings;
  const isGermany = (organization?.country ?? '').toUpperCase() === 'DE';
  const save = useUpdateCurrentOrganizationSettings();

  const initial = {
    legalName: settings.legalName ?? '',
    taxNumber: settings.taxNumber ?? '',
    vatId: settings.vatId ?? '',
  };
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState(false);

  // Nach dem Speichern (oder Organisationswechsel) die Werte aus dem Store übernehmen.
  useEffect(() => {
    setValues({ legalName: settings.legalName ?? '', taxNumber: settings.taxNumber ?? '', vatId: settings.vatId ?? '' });
    setTouched(false);
  }, [organization?.id, settings.legalName, settings.taxNumber, settings.vatId]);

  if (!currentOrganization || !organization) return null;

  const vatError = !isValidVatId(values.vatId) ? t('vatIdInvalid') : null;
  const taxError = !isValidTaxNumber(values.taxNumber) ? t('taxNumberInvalid') : null;
  const dirty =
    values.legalName.trim() !== initial.legalName.trim() ||
    values.taxNumber.trim() !== initial.taxNumber.trim() ||
    normalizeVatId(values.vatId) !== normalizeVatId(initial.vatId);
  const missing = missingMasterData(settings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (vatError || taxError) return;
    save.mutate(
      {
        legalName: values.legalName.trim(),
        taxNumber: values.taxNumber.trim(),
        vatId: normalizeVatId(values.vatId),
      },
      {
        onSuccess: () => toast.success(t('saved')),
        onError: (error) => toast.error(apiErrorMessage(error, t('saveFailed'))),
      },
    );
  };

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="app-card" data-testid="settings-tax">
      <SettingsSectionHead icon="landmark" title={t('title')} description={t('description')} />

      {isGermany && (
        <div style={{ marginBottom: 16 }}>
          <Banner
            tone={missing.length > 0 && organization.tse?.integrationEnabled ? 'warn' : 'info'}
            icon={<Icon name="info" />}
          >
            {t('tseHint')}
          </Banner>
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="tax-legal-name">{t('legalName')}</label>
          <input
            id="tax-legal-name"
            className="input"
            value={values.legalName}
            maxLength={200}
            placeholder={organization.name}
            onChange={set('legalName')}
          />
          <span className="auth-field__hint">{t('legalNameHint')}</span>
        </div>

        <div className="tax-grid">
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="tax-number">{t('taxNumber')}</label>
            <input
              id="tax-number"
              className={`input${touched && taxError ? ' input--error' : ''}`}
              value={values.taxNumber}
              maxLength={30}
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('taxNumberPlaceholder')}
              onChange={set('taxNumber')}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !!taxError}
            />
            {touched && taxError && <span className="auth-field__error" role="alert">{taxError}</span>}
          </div>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="tax-vat-id">{t('vatId')}</label>
            <input
              id="tax-vat-id"
              className={`input${touched && vatError ? ' input--error' : ''}`}
              value={values.vatId}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder={t('vatIdPlaceholder')}
              onChange={set('vatId')}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !!vatError}
            />
            {touched && vatError && <span className="auth-field__error" role="alert">{vatError}</span>}
          </div>
        </div>
        <p className="auth-field__hint" style={{ margin: '-8px 0 0' }}>{t('eitherHint')}</p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
          <button type="submit" className="btn btn--primary" disabled={!dirty || save.isPending} data-testid="settings-tax-save">
            {save.isPending ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
