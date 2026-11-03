'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useUpdateCurrentOrganizationSettings } from '@/hooks/use-organizations';
import { tseKeys } from '@/hooks/use-tse';
import { isValidTaxNumber, isValidVatId, normalizeVatId } from '@/lib/dsfinvk';
import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationSettings } from '@/types/organization';
import type { TseMasterDataField } from '@/types/tse';

interface TseMasterDataFormProps {
  organizationId: string;
  /** Was laut API fehlt — diese Felder sind markiert. */
  missing: TseMasterDataField[];
  onSaved?: () => void;
}

/**
 * Pflichtangaben vor dem Anlegen der Cloud-TSE (DSFinV-K-Stammdaten):
 * Steuernummer oder USt-IdNr. und die Anschrift. Vorbelegt aus den
 * Einstellungen; gespeichert wird in dieselben Felder (Reiter „Kontakt“
 * und „Steuerangaben“).
 */
export function TseMasterDataForm({ organizationId, missing, onSaved }: TseMasterDataFormProps) {
  const t = useTranslations('integrations.tse.masterData');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const save = useUpdateCurrentOrganizationSettings();
  const organization = useAuthStore((state) => state.currentOrganization?.organization);
  const settings = (organization?.settings ?? {}) as OrganizationSettings;

  const [values, setValues] = useState({
    taxNumber: settings.taxNumber ?? '',
    vatId: settings.vatId ?? '',
    street: settings.contact?.address ?? settings.address?.street ?? '',
    zip: settings.contact?.zipCode ?? settings.address?.zip ?? '',
    city: settings.contact?.city ?? settings.address?.city ?? '',
  });
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }));

  const errors: Partial<Record<keyof typeof values, string>> = {};
  if (!values.taxNumber.trim() && !values.vatId.trim()) errors.taxNumber = t('taxRequired');
  else if (!isValidTaxNumber(values.taxNumber)) errors.taxNumber = t('taxNumberInvalid');
  if (!isValidVatId(values.vatId)) errors.vatId = t('vatIdInvalid');
  if (!values.street.trim()) errors.street = t('required');
  if (!values.zip.trim()) errors.zip = t('required');
  if (!values.city.trim()) errors.city = t('required');
  const hasErrors = Object.keys(errors).length > 0;
  const show = (key: keyof typeof values) => (submitted ? errors[key] : undefined);
  const flagged = (field: TseMasterDataField) => missing.includes(field);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors) return;
    save.mutate(
      {
        taxNumber: values.taxNumber.trim(),
        vatId: normalizeVatId(values.vatId),
        contact: {
          ...settings.contact,
          address: values.street.trim(),
          zipCode: values.zip.trim(),
          city: values.city.trim(),
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('saved'));
          await queryClient.invalidateQueries({ queryKey: tseKeys.status(organizationId) });
          onSaved?.();
        },
        onError: (error) => toast.error(apiErrorMessage(error, t('saveFailed'))),
      },
    );
  };

  const field = (
    key: keyof typeof values,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    required = true,
  ) => (
    <div className="auth-field">
      <label className="auth-field__label" htmlFor={`tse-md-${key}`}>
        {label} {required && <span className="auth-field__req">*</span>}
      </label>
      <input
        id={`tse-md-${key}`}
        className={`input${show(key) ? ' input--error' : ''}`}
        value={values[key]}
        onChange={set(key)}
        aria-invalid={!!show(key)}
        {...props}
      />
      {show(key) && (
        <span className="auth-field__error" role="alert">
          {show(key)}
        </span>
      )}
    </div>
  );

  return (
    <form className="tse-masterdata" onSubmit={submit} noValidate data-testid="tse-master-data">
      <div>
        <b>{t('title')}</b>
        <p className="tse-text">{t('text')}</p>
      </div>
      <div className="tse-masterdata__grid">
        {field(
          'taxNumber',
          t('taxNumber'),
          { placeholder: t('taxNumberPlaceholder'), inputMode: 'numeric', autoComplete: 'off', maxLength: 30, autoFocus: flagged('taxNumber') },
          false,
        )}
        {field('vatId', t('vatId'), { placeholder: t('vatIdPlaceholder'), autoComplete: 'off', maxLength: 20 }, false)}
      </div>
      <p className="tse-muted" style={{ margin: 0 }}>{t('eitherHint')}</p>
      {field('street', t('street'), { autoComplete: 'street-address', maxLength: 200 })}
      <div className="tse-masterdata__grid tse-masterdata__grid--zip">
        {field('zip', t('zip'), { autoComplete: 'postal-code', maxLength: 10, inputMode: 'numeric' })}
        {field('city', t('city'), { autoComplete: 'address-level2', maxLength: 100 })}
      </div>
      <div className="tse-setup__actions">
        <button type="submit" className="btn btn--primary" disabled={save.isPending} data-testid="tse-master-data-save">
          {save.isPending ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
