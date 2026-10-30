'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Banner, Icon } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCreateApiToken } from '@/hooks/use-api-tokens';
import { useLocaleFormat } from '@/hooks/use-locale-format';

import {
  API_TOKEN_EXPIRY_PRESETS,
  apiTokenPreview,
  expiresAtFromDateInput,
  expiryDateFromPreset,
  expiryPresetForDate,
  isExpiryInPast,
  toDateInputValue,
} from '@/lib/api-tokens';

import { ORGANIZATION_TOKEN_SCOPES, type ApiTokenScope, type CreatedApiToken } from '@/types/api-token';

import { ScopeChip } from './organization-access-section';

interface ApiTokenCreateDialogProps {
  organizationId: string;
  onClose: () => void;
}

/**
 * Zugang anlegen in zwei Schritten: Formular (Name, Scopes, optionaler
 * Ablauf) und danach die einmalige Anzeige des Klartexts mit Kopieren-Knopf.
 * Im zweiten Schritt schließt nur „Fertig“ — kein Escape, kein Klick
 * daneben —, damit der Token nicht ungesehen verschwindet.
 */
export function ApiTokenCreateDialog({ organizationId, onClose }: ApiTokenCreateDialogProps) {
  const t = useTranslations('settings.organizationAccess.createDialog');
  const tScopes = useTranslations('settings.organizationAccess.scopeLabels');
  const tDesc = useTranslations('settings.organizationAccess.scopeDescriptions');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatDate } = useLocaleFormat();
  const create = useCreateApiToken(organizationId);

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiTokenScope[]>(['read']);
  const [expiry, setExpiry] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const [copied, setCopied] = useState(false);

  const pending = create.isPending;
  const locked = pending || !!created;
  const close = locked ? () => {} : onClose;

  useEffect(() => {
    if (locked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [locked, onClose]);

  const trimmedName = name.trim();
  const nameMissing = trimmedName.length === 0;
  const noScope = scopes.length === 0;
  const expiryPast = isExpiryInPast(expiry);
  const writeWithoutRead = scopes.some((s) => s !== 'read') && !scopes.includes('read');
  const activePreset = expiryPresetForDate(expiry);

  const toggleScope = (scope: ApiTokenScope, checked: boolean) => {
    setScopes((current) => {
      const without = current.filter((s) => s !== scope);
      if (!checked) return without;
      // Reihenfolge wie im Dialog, damit die Chips später stabil stehen.
      return ORGANIZATION_TOKEN_SCOPES.filter((s) => s === scope || without.includes(s));
    });
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    if (nameMissing || noScope || expiryPast) return;
    const expiresAt = expiresAtFromDateInput(expiry);
    create.mutate(
      { name: trimmedName, scopes, ...(expiresAt ? { expiresAt } : {}) },
      {
        onSuccess: (token) => setCreated(token),
        onError: (err) => setError(apiErrorMessage(err, tCommon('error'))),
      }
    );
  };

  const onCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      toast.success(t('copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('copyFailed'));
    }
  };

  return (
    <div className="modal__overlay" onClick={close}>
      <ModalPanel titleId="api-token-create-title" className="modal__panel--md">
        <div className="modal__head">
          <h2 id="api-token-create-title">{created ? t('createdTitle') : t('title')}</h2>
          {!created && <DialogCloseButton onClick={close} />}
        </div>

        {created ? (
          <>
            <div className="modal__body">
              <div className="api-token-reveal">
                <Banner tone="warn" icon={<Icon name="alert" />} title={t('onceTitle')}>
                  {t('onceText')}
                </Banner>

                <div className="api-token-reveal__secret">
                  <code data-testid="api-token-secret">{created.token}</code>
                  <button
                    type="button"
                    className={`btn btn--icon btn--sm ${copied ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={onCopy}
                    title={copied ? t('copied') : t('copy')}
                    aria-label={copied ? t('copied') : t('copy')}
                  >
                    <Icon name={copied ? 'check' : 'copy'} size={16} />
                  </button>
                  <span className="oe-sr-only" aria-live="polite">
                    {copied ? t('copied') : ''}
                  </span>
                </div>

                {error && (
                  <p className="auth-field__error" role="alert">
                    {error}
                  </p>
                )}

                <p className="api-token-reveal__meta">
                  <strong>{created.name}</strong> · {apiTokenPreview(created.tokenPrefix)} ·{' '}
                  {created.expiresAt
                    ? t('expiresOn', { date: formatDate(created.expiresAt) })
                    : t('neverExpires')}
                </p>
                <div className="api-token__scopes" aria-label={t('scopesLegend')}>
                  {created.scopes.map((scope) => (
                    <ScopeChip key={scope} scope={scope} />
                  ))}
                </div>
                <p className="api-token-form__hint">{t('usage')}</p>
              </div>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                {t('done')}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className="modal__body">
              <div className="api-token-form">
                {/* Oben, damit die Antwort der API (z. B. Höchstzahl erreicht)
                    ohne Scrollen zu sehen ist. */}
                {error && (
                  <Banner tone="danger" icon={<Icon name="alert" />}>
                    {error}
                  </Banner>
                )}
                <label className={`auth-field${submitted && nameMissing ? ' auth-field--error' : ''}`}>
                  <span>
                    {t('name')} <span className="auth-field__req">*</span>
                  </span>
                  <input
                    type="text"
                    value={name}
                    maxLength={100}
                    autoFocus
                    placeholder={t('namePlaceholder')}
                    onChange={(e) => setName(e.target.value)}
                    disabled={pending}
                  />
                  {submitted && nameMissing && (
                    <span role="alert" className="auth-field__error">
                      {t('nameRequired')}
                    </span>
                  )}
                </label>

                <fieldset className="api-token-form__scopes" disabled={pending}>
                  <legend className="auth-field__label">{t('scopesLegend')}</legend>
                  {ORGANIZATION_TOKEN_SCOPES.map((scope) => {
                    const checked = scopes.includes(scope);
                    return (
                      <label key={scope} className={`api-token-form__scope${checked ? ' is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleScope(scope, e.target.checked)}
                        />
                        <span className="api-token-form__scope-text">
                          <span className="api-token-form__scope-name">
                            {tScopes(scope)}
                            <span className="api-token-form__scope-code">{scope}</span>
                            {scope === 'read' && <span className="badge badge--success">{t('recommended')}</span>}
                          </span>
                          <span className="api-token-form__scope-desc">{tDesc(scope)}</span>
                        </span>
                      </label>
                    );
                  })}
                  {submitted && noScope && (
                    <span role="alert" className="auth-field__error">
                      {t('scopeRequired')}
                    </span>
                  )}
                  <p className="api-token-form__hint">
                    {writeWithoutRead ? t('writeWithoutRead') : t('writeHint')}
                  </p>
                </fieldset>

                <div className={`auth-field${submitted && expiryPast ? ' auth-field--error' : ''}`}>
                  <span className="auth-field__label">{t('expiry')}</span>
                  <div className="api-token-form__presets" role="group" aria-label={t('expiryPresets')}>
                    {API_TOKEN_EXPIRY_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`api-token-form__preset${activePreset === preset ? ' is-active' : ''}`}
                        aria-pressed={activePreset === preset}
                        onClick={() => setExpiry(expiryDateFromPreset(preset))}
                        disabled={pending}
                      >
                        {preset === 'never' ? t('never') : t('days', { days: preset })}
                      </button>
                    ))}
                  </div>
                  <input
                    type="date"
                    aria-label={t('expiryDate')}
                    value={expiry}
                    min={toDateInputValue(new Date())}
                    onChange={(e) => setExpiry(e.target.value)}
                    disabled={pending}
                  />
                  {submitted && expiryPast ? (
                    <span role="alert" className="auth-field__error">
                      {t('expiryPast')}
                    </span>
                  ) : (
                    <span className="auth-field__hint">
                      {expiry && !expiryPast
                        ? t('expiresOn', { date: formatDate(expiresAtFromDateInput(expiry)) })
                        : t('expiryHint')}
                    </span>
                  )}
                </div>

              </div>
            </div>

            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={pending}>
                {tCommon('cancel')}
              </button>
              <button type="submit" className="btn btn--primary" disabled={pending}>
                {pending ? t('pending') : t('submit')}
              </button>
            </div>
          </form>
        )}
      </ModalPanel>
    </div>
  );
}
