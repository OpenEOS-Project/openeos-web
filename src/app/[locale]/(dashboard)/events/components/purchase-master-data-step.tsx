'use client';

import { type FormEvent, useState } from 'react';

import { useTranslations } from 'next-intl';

import { validatePurchaseMasterData } from '@/utils/purchase-master-data';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';

import { billingApi } from '@/lib/api-client';
import { normalizeVatId } from '@/lib/dsfinvk';

import type {
  PurchaseMasterDataField,
  PurchaseMasterDataStatus,
  PurchaseMasterDataValues,
} from '@/types/billing';

interface PurchaseMasterDataStepProps {
  organizationId: string;
  status: PurchaseMasterDataStatus;
  /** Was laut API fehlt (mit der aktuellen Wahl zur Cloud-TSE). */
  missing: PurchaseMasterDataField[];
  /** Freischaltung mit Cloud-TSE (DE): Steuernummer oder USt-IdNr. ist Pflicht. */
  withTse: boolean;
  /** Formular-ID, damit der Knopf im Dialogfuß absenden kann. */
  formId: string;
  onSaved: (status: PurchaseMasterDataStatus) => void;
  onPendingChange?: (pending: boolean) => void;
}

/**
 * Schritt „Angaben zu deiner Organisation“ im Aktivierungsdialog: Die
 * Registrierung fragt keine Steuerdaten; erst vor dem ersten Kauf braucht
 * es offiziellen Namen und Rechnungsanschrift, mit Cloud-TSE zusätzlich
 * Steuernummer oder USt-IdNr. Gespeichert wird in die Organisation
 * (dieselben Felder wie Einstellungen → Steuerangaben/Kontakt), danach
 * geht es zur Zahlung weiter.
 */
export function PurchaseMasterDataStep({
  organizationId,
  status,
  missing,
  withTse,
  formId,
  onSaved,
  onPendingChange,
}: PurchaseMasterDataStepProps) {
  const t = useTranslations('events.checkout.masterData');
  const apiErrorMessage = useApiErrorMessage();
  const [values, setValues] = useState<PurchaseMasterDataValues>({ ...status.values });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const errors = validatePurchaseMasterData(values, { withTse, country: status.country });
  const show = (key: keyof PurchaseMasterDataValues) => {
    const err = submitted ? errors[key] : undefined;
    return err ? t(`errors.${err}`) : undefined;
  };
  const set = (key: keyof PurchaseMasterDataValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    setPending(true);
    onPendingChange?.(true);
    try {
      const response = await billingApi.savePurchaseMasterData(organizationId, {
        legalName: values.legalName.trim(),
        street: values.street.trim(),
        zip: values.zip.trim(),
        city: values.city.trim(),
        ...(withTse || values.taxNumber.trim() || status.values.taxNumber
          ? { taxNumber: values.taxNumber.trim() }
          : {}),
        ...(withTse || values.vatId.trim() || status.values.vatId
          ? { vatId: normalizeVatId(values.vatId) }
          : {}),
      });
      onSaved(response.data);
    } catch (err) {
      setError(apiErrorMessage(err, t('saveFailed')));
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  };

  const flagged = (field: PurchaseMasterDataField) => missing.includes(field);
  const field = (
    key: keyof PurchaseMasterDataValues,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    required = true
  ) => (
    <label className="auth-field" htmlFor={`purchase-md-${key}`}>
      <span>
        {label} {required && <span className="auth-field__req">*</span>}
      </span>
      <input
        id={`purchase-md-${key}`}
        className={`input${show(key) ? 'input--error' : ''}`}
        value={values[key]}
        onChange={set(key)}
        aria-invalid={!!show(key)}
        disabled={pending}
        data-testid={`purchase-md-${key}`}
        {...props}
      />
      {show(key) && (
        <span className="auth-field__error" role="alert">
          {show(key)}
        </span>
      )}
    </label>
  );

  return (
    <form
      id={formId}
      onSubmit={submit}
      noValidate
      data-testid="purchase-master-data"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{t('title')}</div>
        <p
          style={{
            fontSize: 13,
            color: 'color-mix(in oklab, var(--ink) 65%, transparent)',
            margin: '4px 0 0',
          }}
        >
          {withTse ? t('textWithTse') : t('text')}
        </p>
      </div>

      {field('legalName', t('legalName'), {
        placeholder: t('legalNamePlaceholder'),
        autoComplete: 'organization',
        maxLength: 200,
        autoFocus: flagged('legalName'),
      })}
      {field('street', t('street'), { autoComplete: 'street-address', maxLength: 200 })}
      <div className="field-row field-row--narrow-start">
        {field('zip', t('zip'), {
          autoComplete: 'postal-code',
          inputMode: 'numeric',
          maxLength: 10,
        })}
        {field('city', t('city'), { autoComplete: 'address-level2', maxLength: 100 })}
      </div>

      {withTse && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
          }}
          data-testid="purchase-md-tax"
        >
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>
            <b>{t('taxTitle')}</b>
            <span
              style={{
                display: 'block',
                fontSize: 12,
                color: 'color-mix(in oklab, var(--ink) 55%, transparent)',
              }}
            >
              {t('taxHint')}
            </span>
          </div>
          {field(
            'taxNumber',
            t('taxNumber'),
            {
              placeholder: t('taxNumberPlaceholder'),
              inputMode: 'numeric',
              autoComplete: 'off',
              maxLength: 30,
              autoFocus: !flagged('legalName') && flagged('taxNumber'),
            },
            false
          )}
          {field(
            'vatId',
            t('vatId'),
            { placeholder: t('vatIdPlaceholder'), autoComplete: 'off', maxLength: 20 },
            false
          )}
        </div>
      )}

      <p
        style={{
          fontSize: 12,
          color: 'color-mix(in oklab, var(--ink) 55%, transparent)',
          margin: 0,
        }}
      >
        {t('savedTo')}
      </p>

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'color-mix(in oklab, var(--danger) 10%, var(--paper))',
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
