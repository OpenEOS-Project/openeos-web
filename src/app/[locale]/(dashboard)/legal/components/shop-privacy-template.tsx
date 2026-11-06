'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Info, ShoppingBag, TriangleAlert } from 'lucide-react';

import { DetailPageHead } from '@/components/shared/detail-page-head';
import { LegalText } from '@/components/public-legal/legal-text';
import { Link } from '@/i18n/routing';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { usePermissions } from '@/hooks/use-permissions';
import { organizationsApi } from '@/lib/api-client';
import { LEGAL_LIMITS, type OrganizationLegalSettings } from '@/lib/legal';
import {
  PAYMENT_PROVIDER_OPTIONS,
  fillShopPrivacyTemplate,
  missingTemplateFields,
  organizationTemplateValues,
  parseShopPrivacyTemplate,
  type TemplateField,
} from '@/lib/shop-privacy-template';
import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationSettings } from '@/types/organization';

import '@/styles/legal.css';

const TEMPLATE = parseShopPrivacyTemplate();

/**
 * Vorlage für den Datenschutzhinweis im Shop und auf den Helferseiten.
 *
 * Die Angaben der Organisation sind vorbelegt, alles in eckigen Klammern
 * entscheidet der Verein selbst. Übernommen wird erst, wenn jedes Feld
 * ausgefüllt und der Text geprüft ist — dann landet er als
 * `settings.legal.privacyText` dort, wo ihn die rechtlichen Angaben
 * ohnehin verwalten.
 */
export function ShopPrivacyTemplateView() {
  const t = useTranslations('legal.shop');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const organization = currentOrganization?.organization;
  const settings = (organization?.settings || {}) as OrganizationSettings;
  const existing: OrganizationLegalSettings = settings.legal ?? {};

  const [values, setValues] = useState<Record<string, string>>(() => organizationTemplateValues(organization));
  const [reviewed, setReviewed] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = useMemo(() => fillShopPrivacyTemplate(TEMPLATE, values), [values]);
  const missing = missingTemplateFields(TEMPLATE, values);
  const hasExisting = !!(existing.privacyUrl?.trim() || existing.privacyText?.trim());
  const tooLong = text.length > LEGAL_LIMITS.privacyText;

  const save = useMutation({
    mutationFn: async () => {
      if (!currentOrganization) throw new Error('No organization');
      // Link oder Text, nie beides (wie in den rechtlichen Angaben): der
      // übernommene Text ersetzt einen hinterlegten Link.
      const legal: OrganizationLegalSettings = { ...existing, privacyText: text };
      delete legal.privacyUrl;
      const response = await organizationsApi.update(currentOrganization.organizationId, { settings: { legal } });
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization) {
        setCurrentOrganization({ ...currentOrganization, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setSaved(true);
      setReplaceConfirmed(false);
    },
    onError: (err) => setError(apiErrorMessage(err, t('saveFailed'))),
  });

  const canSave =
    isAdmin && missing.length === 0 && reviewed && (!hasExisting || replaceConfirmed) && !tooLong && !save.isPending;

  const setValue = (id: string, value: string) => {
    setValues((v) => ({ ...v, [id]: value }));
    setSaved(false);
    setError(null);
  };

  const orgFields = TEMPLATE.fields.filter((f) => f.kind === 'name' || f.kind === 'address' || f.kind === 'email');
  const choiceFields = TEMPLATE.fields.filter((f) => f.kind === 'text' || f.kind === 'payment');

  return (
    <div className="legal-page">
      <DetailPageHead
        backHref="/legal"
        backLabel={t('back')}
        icon={<ShoppingBag />}
        title={t('title')}
        meta={TEMPLATE.stand ? t('subtitleStand', { stand: TEMPLATE.stand }) : t('subtitle')}
      />

      <section className="app-card legal-intro" aria-labelledby="shop-template-guidance">
        <h2 id="shop-template-guidance" className="legal-card__title">
          {t('guidanceTitle')}
        </h2>
        {TEMPLATE.intro.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
        <ul className="legal-guidance">
          {TEMPLATE.guidance.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="legal-template">
        <section className="app-card legal-template__form" aria-labelledby="shop-template-fields">
          <h2 id="shop-template-fields" className="legal-card__title">
            {t('orgTitle')}
          </h2>
          <p className="legal-card__text">{t('orgText')}</p>
          <div className="legal-template__fields">
            {orgFields.map((field) => (
              <TemplateInput key={field.id} field={field} value={values[field.id] ?? ''} onChange={setValue} />
            ))}
          </div>

          <h2 className="legal-card__title legal-card__title--spaced">{t('choicesTitle')}</h2>
          <p className="legal-card__text">{t('choicesText')}</p>
          <div className="legal-template__fields">
            {choiceFields.map((field) => (
              <TemplateInput key={field.id} field={field} value={values[field.id] ?? ''} onChange={setValue} />
            ))}
          </div>

          <div className="legal-template__confirm">
            {hasExisting && !saved && (
              <div className="legal-warning" role="status">
                <p className="legal-warning__title">
                  <TriangleAlert aria-hidden="true" />
                  {t('replaceTitle')}
                </p>
                <p className="legal-warning__text">
                  {existing.privacyUrl ? t('replaceUrl', { url: existing.privacyUrl }) : t('replaceText')}
                </p>
                <label className="auth-check auth-check--block">
                  <input
                    type="checkbox"
                    checked={replaceConfirmed}
                    onChange={(e) => setReplaceConfirmed(e.target.checked)}
                    disabled={!isAdmin}
                  />
                  <span>{t('replaceConfirm')}</span>
                </label>
              </div>
            )}

            <label className="auth-check auth-check--block">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => {
                  setReviewed(e.target.checked);
                  setSaved(false);
                }}
                disabled={!isAdmin}
                data-testid="shop-template-reviewed"
              />
              <span>{t('reviewed')}</span>
            </label>

            {missing.length > 0 && (
              <p className="legal-template__missing" data-testid="shop-template-missing">
                {t('missing', { count: missing.length })}
              </p>
            )}
            {tooLong && <p className="auth-form__error">{t('tooLong', { max: LEGAL_LIMITS.privacyText })}</p>}
            {!isAdmin && (
              <p className="legal-hint">
                <Info aria-hidden="true" />
                <span>{t('adminOnly')}</span>
              </p>
            )}
            {error && (
              <div className="auth-form__error" role="alert">
                {error}
              </div>
            )}
            {saved && (
              <div className="legal-success" role="status" data-testid="shop-template-saved">
                <CircleCheck aria-hidden="true" />
                <span>
                  {t.rich('saved', {
                    link: (chunks) => <Link href="/settings?tab=org-legal">{chunks}</Link>,
                  })}
                </span>
              </div>
            )}

            <div className="legal-template__actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canSave}
                onClick={() => {
                  setError(null);
                  save.mutate();
                }}
                data-testid="shop-template-save"
              >
                {save.isPending ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </section>

        <section className="app-card legal-template__preview" aria-labelledby="shop-template-preview">
          <h2 id="shop-template-preview" className="legal-card__title">
            {t('previewTitle')}
          </h2>
          <p className="legal-card__text">{t('previewText')}</p>
          <div className="legal-settings__preview legal-template__preview-text" data-testid="shop-template-preview">
            <LegalText text={text} />
          </div>
        </section>
      </div>
    </div>
  );
}

function fieldLabel(field: TemplateField, t: ReturnType<typeof useTranslations<'legal.shop'>>): string {
  if (field.kind === 'name') return t('fields.name');
  if (field.kind === 'address') return t('fields.address');
  if (field.kind === 'email') return t('fields.email');
  return field.label;
}

function TemplateInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (id: string, value: string) => void;
}) {
  const t = useTranslations('legal.shop');
  const id = `shop-template-${field.id.replace(/[^a-z0-9-]/gi, '-')}`;
  const empty = !value.trim();
  const label = fieldLabel(field, t);
  const hint =
    field.kind === 'name'
      ? t('fields.nameHint')
      : field.kind === 'address'
        ? t('fields.addressHint')
        : field.kind === 'email'
          ? t('fields.emailHint')
          : null;

  return (
    <div className={`auth-field${empty ? ' legal-template__field--empty' : ''}`}>
      <label className="auth-field__label" htmlFor={id}>
        {label} <span className="auth-field__req">*</span>
      </label>
      {field.kind === 'payment' ? (
        <select id={id} className="input" value={value} onChange={(e) => onChange(field.id, e.target.value)}>
          <option value="">{t('fields.choose')}</option>
          {PAYMENT_PROVIDER_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.kind === 'address' || field.kind === 'text' ? (
        <textarea
          id={id}
          rows={field.kind === 'address' ? 3 : 2}
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input"
          type={field.kind === 'email' ? 'email' : 'text'}
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      )}
      {hint && <span className="auth-field__hint">{hint}</span>}
    </div>
  );
}
