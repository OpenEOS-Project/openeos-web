'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Scale } from 'lucide-react';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { organizationsApi } from '@/lib/api-client';
import { LegalText } from '@/components/public-legal/legal-text';
import {
  LEGAL_LIMITS,
  isHttpUrl,
  isLegalInfoComplete,
  type OrganizationLegalSettings,
} from '@/lib/legal';
import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationSettings } from '@/types/organization';
import { ApiException } from '@/types/api';

type Mode = 'url' | 'text';
type Kind = 'imprint' | 'privacy';

interface NoticeState {
  mode: Mode;
  url: string;
  text: string;
}

interface FormState {
  imprint: NoticeState;
  privacy: NoticeState;
  contactEmail: string;
}

type FieldKey = 'imprintUrl' | 'imprintText' | 'privacyUrl' | 'privacyText' | 'contactEmail';
type Errors = Partial<Record<FieldKey, string>>;

function toNotice(url?: string, text?: string): NoticeState {
  return { mode: text && !url ? 'text' : 'url', url: url ?? '', text: text ?? '' };
}

function fromSettings(legal: OrganizationLegalSettings | undefined): FormState {
  return {
    imprint: toNotice(legal?.imprintUrl, legal?.imprintText),
    privacy: toNotice(legal?.privacyUrl, legal?.privacyText),
    contactEmail: legal?.contactEmail ?? '',
  };
}

/** Nur die gewaehlte Variante geht an die API, die andere wird geleert. */
function toPayload(form: FormState): OrganizationLegalSettings {
  const pick = (n: NoticeState) =>
    n.mode === 'url' ? { url: n.url.trim(), text: '' } : { url: '', text: n.text.trim() };
  const imprint = pick(form.imprint);
  const privacy = pick(form.privacy);
  const out: OrganizationLegalSettings = {};
  if (imprint.url) out.imprintUrl = imprint.url;
  if (imprint.text) out.imprintText = imprint.text;
  if (privacy.url) out.privacyUrl = privacy.url;
  if (privacy.text) out.privacyText = privacy.text;
  if (form.contactEmail.trim()) out.contactEmail = form.contactEmail.trim();
  return out;
}

/**
 * Impressum und Datenschutzhinweis des Vereins fuer Shop und Helferseiten.
 *
 * Der Verein verkauft und sammelt Helferdaten — er ist Anbieter und
 * Verantwortlicher, nicht OpenEOS. Je Angabe ein Link auf die eigene Seite
 * oder ein Text, den OpenEOS selbst anzeigt.
 */
export function OrganizationLegalSection() {
  const t = useTranslations('settings.organizationLegal');
  const apiErrorMessage = useApiErrorMessage();
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();

  const settings = (currentOrganization?.organization?.settings || {}) as OrganizationSettings;
  const [saved, setSaved] = useState<FormState>(() => fromSettings(settings.legal));
  const [form, setForm] = useState<FormState>(saved);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [preview, setPreview] = useState<Record<Kind, boolean>>({ imprint: false, privacy: false });

  const isDirty = JSON.stringify(toPayload(form)) !== JSON.stringify(toPayload(saved));
  const complete = isLegalInfoComplete(toPayload(saved));

  function validate(state: FormState): Errors {
    const next: Errors = {};
    for (const kind of ['imprint', 'privacy'] as const) {
      const n = state[kind];
      if (n.mode === 'url') {
        const url = n.url.trim();
        if (url && url.length > LEGAL_LIMITS.url) next[`${kind}Url`] = t('errors.urlTooLong', { max: LEGAL_LIMITS.url });
        else if (url && !isHttpUrl(url)) next[`${kind}Url`] = t('errors.url');
      } else {
        const max = LEGAL_LIMITS[`${kind}Text`];
        if (n.text.trim().length > max) next[`${kind}Text`] = t('errors.textTooLong', { max });
      }
    }
    const email = state.contactEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.contactEmail = t('errors.email');
    return next;
  }

  const save = useMutation({
    mutationFn: async (payload: OrganizationLegalSettings) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        settings: { legal: payload },
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({ ...currentOrganization, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      const next = fromSettings((data.settings as OrganizationSettings | undefined)?.legal);
      setSaved(next);
      setForm(next);
      setJustSaved(true);
    },
    onError: (err) => {
      // Feldfehler der API (details[].field = legal.<feld>) dem Feld zuordnen.
      if (err instanceof ApiException && err.details?.length) {
        const fieldErrors: Errors = {};
        for (const d of err.details) {
          const key = d.field?.replace(/^legal\./, '') as FieldKey | undefined;
          if (key && ['imprintUrl', 'imprintText', 'privacyUrl', 'privacyText', 'contactEmail'].includes(key)) {
            fieldErrors[key] = errorForCode(d.code, key);
          }
        }
        if (Object.keys(fieldErrors).length) {
          setErrors(fieldErrors);
          return;
        }
      }
      setSubmitError(apiErrorMessage(err, t('errors.saveFailed')));
    },
  });

  function errorForCode(code: string | undefined, key: FieldKey): string {
    switch (code) {
      case 'url':
        return t('errors.url');
      case 'email':
        return t('errors.email');
      case 'linkOrText':
        return t('errors.linkOrText');
      case 'maxLength':
        return key.endsWith('Url')
          ? t('errors.urlTooLong', { max: LEGAL_LIMITS.url })
          : t('errors.textTooLong', { max: key === 'imprintText' ? LEGAL_LIMITS.imprintText : LEGAL_LIMITS.privacyText });
      default:
        return t('errors.saveFailed');
    }
  }

  function updateNotice(kind: Kind, patch: Partial<NoticeState>) {
    setForm((f) => ({ ...f, [kind]: { ...f[kind], ...patch } }));
    setErrors({});
    setSubmitError(null);
    setJustSaved(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate(form);
    setErrors(next);
    setSubmitError(null);
    if (Object.keys(next).length) return;
    save.mutate(toPayload(form));
  }

  if (!currentOrganization) return null;

  const renderNotice = (kind: Kind) => {
    const n = form[kind];
    const urlKey = `${kind}Url` as const;
    const textKey = `${kind}Text` as const;
    const max = LEGAL_LIMITS[textKey];
    return (
      <fieldset className="legal-settings__notice">
        <div className="form-section__head">
          <legend className="auth-field__label">{t(`${kind}.label`)}</legend>
          <div className="oe-segment" role="group" aria-label={t('modeLabel', { notice: t(`${kind}.label`) })}>
            {(['url', 'text'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={n.mode === mode}
                className={n.mode === mode ? 'is-active' : undefined}
                onClick={() => updateNotice(kind, { mode })}
              >
                {t(`mode.${mode}`)}
              </button>
            ))}
          </div>
        </div>

        {n.mode === 'url' ? (
          <label className={`auth-field${errors[urlKey] ? ' auth-field--error' : ''}`}>
            <span className="oe-sr-only">{t(`${kind}.urlLabel`)}</span>
            <input
              type="url"
              inputMode="url"
              className="input"
              value={n.url}
              placeholder={t(`${kind}.urlPlaceholder`)}
              maxLength={LEGAL_LIMITS.url}
              onChange={(e) => updateNotice(kind, { url: e.target.value })}
            />
            {errors[urlKey] ? (
              <span className="auth-field__error">{errors[urlKey]}</span>
            ) : (
              <span className="auth-field__hint">{t(`${kind}.urlHint`)}</span>
            )}
          </label>
        ) : (
          <>
            <label className={`auth-field${errors[textKey] ? ' auth-field--error' : ''}`}>
              <span className="oe-sr-only">{t(`${kind}.textLabel`)}</span>
              <textarea
                rows={kind === 'privacy' ? 12 : 8}
                value={n.text}
                placeholder={t(`${kind}.textPlaceholder`)}
                maxLength={max}
                onChange={(e) => updateNotice(kind, { text: e.target.value })}
              />
              {errors[textKey] ? (
                <span className="auth-field__error">{errors[textKey]}</span>
              ) : (
                <span className="auth-field__hint">
                  {t('textHint')} · {t('charCount', { count: n.text.length, max })}
                </span>
              )}
            </label>
            {n.text.trim() && (
              <div>
                <button
                  type="button"
                  className="btn btn--ghost btn--control"
                  aria-expanded={preview[kind]}
                  onClick={() => setPreview((p) => ({ ...p, [kind]: !p[kind] }))}
                >
                  {preview[kind] ? t('hidePreview') : t('showPreview')}
                </button>
                {preview[kind] && (
                  <div className="legal-settings__preview" aria-label={t('previewLabel')}>
                    <LegalText text={n.text} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </fieldset>
    );
  };

  const payload = toPayload(form);
  const footerPreview = (
    <div className="legal-settings__footer-preview" aria-label={t('footerPreviewLabel')}>
      <span className="legal-settings__footer-preview-label">{t('footerPreview')}</span>
      <span>
        {t('footerResponsible', { organization: currentOrganization.organization?.name ?? '' })}
        {' · '}
        <u>{t('imprint.short')}</u>
        {!(payload.imprintUrl || payload.imprintText) && <em> ({t('missing')})</em>}
        {' · '}
        <u>{t('privacy.short')}</u>
        {!(payload.privacyUrl || payload.privacyText) && <em> ({t('missing')})</em>}
      </span>
      <small>{t('footerPlatform')}</small>
    </div>
  );

  return (
    <div className="app-card" id="org-legal">
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span className="detail-head__icon" aria-hidden="true" style={{ flexShrink: 0 }}>
          <Scale />
        </span>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t('title')}</h2>
          <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', margin: 0 }}>
            {t('description')}
          </p>
        </div>
      </div>

      {!complete && (
        <div className="legal-warning" role="status" style={{ marginBottom: 16 }}>
          <p className="legal-warning__title">{t('incompleteTitle')}</p>
          <p className="legal-warning__text">{t('incompleteText')}</p>
        </div>
      )}

      <div className="legal-settings__intro">
        <p>{t('why')}</p>
        <p>
          {t.rich('templates', {
            imprintGen: (chunks) => (
              <a href="https://www.e-recht24.de/impressum-generator.html" target="_blank" rel="noopener noreferrer">
                {chunks}
                <ExternalLink aria-hidden="true" className="legal-settings__ext" />
              </a>
            ),
            privacyGen: (chunks) => (
              <a href="https://datenschutz-generator.de/" target="_blank" rel="noopener noreferrer">
                {chunks}
                <ExternalLink aria-hidden="true" className="legal-settings__ext" />
              </a>
            ),
          })}
        </p>
        <p className="legal-settings__disclaimer">{t('noLegalAdvice')}</p>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }} noValidate>
        {renderNotice('imprint')}
        {renderNotice('privacy')}

        <label className={`auth-field${errors.contactEmail ? ' auth-field--error' : ''}`}>
          <span>{t('contactEmail')}</span>
          <input
            type="email"
            className="input"
            value={form.contactEmail}
            placeholder={t('contactEmailPlaceholder')}
            maxLength={LEGAL_LIMITS.contactEmail}
            onChange={(e) => {
              setForm((f) => ({ ...f, contactEmail: e.target.value }));
              setErrors({});
              setJustSaved(false);
            }}
          />
          {errors.contactEmail ? (
            <span className="auth-field__error">{errors.contactEmail}</span>
          ) : (
            <span className="auth-field__hint">{t('contactEmailHint')}</span>
          )}
        </label>

        {footerPreview}

        {submitError && <div className="auth-form__error">{submitError}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
          {justSaved && !isDirty && (
            <span role="status" style={{ fontSize: 13, color: 'var(--green-ink)' }}>{t('saved')}</span>
          )}
          <button type="submit" className="btn btn--primary" disabled={!isDirty || save.isPending}>
            {save.isPending ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
