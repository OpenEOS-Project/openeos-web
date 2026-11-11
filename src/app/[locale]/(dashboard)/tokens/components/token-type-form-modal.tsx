'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

import { ColorPicker } from '@/components/shared/color-picker';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { PriceInput } from '@/components/shared/price-input';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCategories } from '@/hooks/use-categories';
import { useEvents } from '@/hooks/use-events';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useOrganization } from '@/hooks/use-organizations';
import { useProducts } from '@/hooks/use-products';
import { useCreateTokenType, useUpdateTokenType } from '@/hooks/use-token-types';
import {
  DEFAULT_TOKEN_COLOR,
  TOKEN_NAME_MAX,
  formatRate,
  hasRestriction,
  lockedTokenFields,
  normalizeTokenApiError,
  restrictedProducts,
  singlePurposeRates,
  tokenTypeFormDefaults,
  tokenTypePayload,
  validateTokenTypeForm,
  type TokenFormField,
  type TokenFormIssue,
  type TokenTypeFormValues,
} from '@/lib/token-admin';
import type { TokenKind, TokenType } from '@/types/token';

interface TokenTypeFormModalProps {
  isOpen: boolean;
  organizationId: string;
  tokenType?: TokenType | null;
  onClose: () => void;
}

/**
 * Markentyp anlegen/bearbeiten. Art (Mehrzweck/Einzweck) mit Erklärung,
 * beim Einzweckgutschein der eine Satz; optional eine Veranstaltung und
 * darin Kategorien/Artikel. Fehler der API (TOKEN_*) kommen übersetzt.
 */
export function TokenTypeFormModal({ isOpen, organizationId, tokenType, onClose }: TokenTypeFormModalProps) {
  if (!isOpen) return null;
  return (
    <TokenTypeForm
      key={tokenType?.id ?? 'new'}
      organizationId={organizationId}
      tokenType={tokenType ?? null}
      onClose={onClose}
    />
  );
}

function TokenTypeForm({
  organizationId,
  tokenType,
  onClose,
}: {
  organizationId: string;
  tokenType: TokenType | null;
  onClose: () => void;
}) {
  const t = useTranslations('tokens');
  const tForm = useTranslations('tokens.form');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { formatCurrency } = useLocaleFormat();
  const isEditing = !!tokenType;

  const [values, setValues] = useState<TokenTypeFormValues>(() => tokenTypeFormDefaults(tokenType));
  const [restrict, setRestrict] = useState(() => hasRestriction(values));
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const createType = useCreateTokenType(organizationId);
  const updateType = useUpdateTokenType(organizationId);
  const pending = createType.isPending || updateType.isPending;

  const { data: organization } = useOrganization(organizationId);
  const vatExempt = organization?.settings?.vatExempt;
  const country = organization?.country;
  const rates = useMemo(() => singlePurposeRates(country, vatExempt), [country, vatExempt]);
  // Einzweck nur, wo es Sätze gibt (nicht als Kleinunternehmer) — ein
  // bestehender Einzweck-Typ bleibt sichtbar, damit nichts verschwindet.
  const showSinglePurpose = rates.length > 0 || values.kind === 'single_purpose';
  const rateOptions =
    values.vatRate !== null && !rates.includes(values.vatRate) ? [...rates, values.vatRate] : rates;

  const { data: events = [] } = useEvents(organizationId);
  const eventId = values.eventId ?? '';
  const { data: categories = [], isLoading: categoriesLoading } = useCategories(eventId);
  const { data: products, isLoading: productsLoading } = useProducts(eventId);

  const locked = lockedTokenFields(tokenType);
  const issues = useMemo(
    () => validateTokenTypeForm(values, { vatExempt, products: values.eventId ? products : null }),
    [values, vatExempt, products],
  );

  // Einzweck gewählt, aber noch kein Satz: den ersten anbieten.
  useEffect(() => {
    if (values.kind === 'single_purpose' && values.vatRate === null && rates.length > 0) {
      setValues((prev) => ({ ...prev, vatRate: rates[0] }));
    }
  }, [values.kind, values.vatRate, rates]);

  const set = <K extends keyof TokenTypeFormValues>(key: K, value: TokenTypeFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const issueText = (issue: TokenFormIssue) =>
    issue.error === 'mixedRates'
      ? tForm('errors.mixedRates', {
          rate: formatRate(issue.rate ?? 0, locale),
          rates: (issue.rates ?? []).map((r) => formatRate(r, locale)).join(', '),
        })
      : tForm(`errors.${issue.error}`, { max: TOKEN_NAME_MAX });

  const fieldError = (field: TokenFormField) => {
    // Gemischte Sätze zeigt die Auswahl sofort, alles andere nach dem ersten Speichern.
    const issue = issues.find((i) => i.field === field && (submitted || i.error === 'mixedRates'));
    return issue ? (
      <span role="alert" className="token-form__error">
        {issueText(issue)}
      </span>
    ) : null;
  };

  const setKind = (kind: TokenKind) =>
    setValues((prev) => ({
      ...prev,
      kind,
      vatRate: kind === 'single_purpose' ? (prev.vatRate ?? rates[0] ?? null) : null,
    }));

  const setEvent = (next: string) => {
    if (!next) setRestrict(false);
    setValues((prev) => ({
      ...prev,
      eventId: next || null,
      // Kategorien und Artikel gehören zu einer Veranstaltung.
      allowedCategoryIds: next === prev.eventId ? prev.allowedCategoryIds : [],
      allowedProductIds: next === prev.eventId ? prev.allowedProductIds : [],
    }));
  };

  const setRestriction = (next: boolean) => {
    setRestrict(next);
    if (!next) setValues((prev) => ({ ...prev, allowedCategoryIds: [], allowedProductIds: [] }));
  };

  const toggle = (key: 'allowedCategoryIds' | 'allowedProductIds', id: string, checked: boolean) =>
    setValues((prev) => ({
      ...prev,
      [key]: checked ? [...new Set([...prev[key], id])] : prev[key].filter((x) => x !== id),
    }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setApiError(null);
    if (issues.length > 0) return;
    const data = tokenTypePayload(values);
    try {
      if (tokenType) {
        await updateType.mutateAsync({ id: tokenType.id, data });
        toast.success(t('toast.updated', { name: data.name ?? '' }));
      } else {
        await createType.mutateAsync(data);
        toast.success(t('toast.created', { name: data.name ?? '' }));
      }
      onClose();
    } catch (err) {
      setApiError(apiErrorMessage(normalizeTokenApiError(err, locale), tCommon('error')));
    }
  };

  const affected = restrictedProducts(products ?? [], values.allowedCategoryIds, values.allowedProductIds);
  const restrictionDisabled = locked.restriction || pending;

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div
        className="modal__panel modal__panel--lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-type-form-title"
        data-testid="token-type-form"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id="token-type-form-title">{isEditing ? t('edit') : t('create')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <div className="modal__body token-form">
            {apiError && (
              <Banner tone="danger" icon={<Icon name="alert" />}>
                <span data-testid="token-type-form-error">{apiError}</span>
              </Banner>
            )}
            {tokenType?.inUse && (
              <Banner tone="info" icon={<Icon name="info" />}>
                {tForm('lockedHint')}
              </Banner>
            )}

            <div className="token-form__row">
              <label className="auth-field">
                <span>
                  {tForm('name')} <span className="auth-field__req">*</span>
                </span>
                <input
                  type="text"
                  value={values.name}
                  maxLength={TOKEN_NAME_MAX}
                  placeholder={tForm('namePlaceholder')}
                  onChange={(e) => set('name', e.target.value)}
                  autoFocus={!isEditing}
                  data-testid="token-type-name"
                />
                {fieldError('name')}
              </label>

              <label className="auth-field">
                <span>
                  {tForm('value')} <span className="auth-field__req">*</span>
                </span>
                {locked.value ? (
                  <input type="text" value={formatCurrency(values.value)} disabled readOnly />
                ) : (
                  <PriceInput
                    value={values.value}
                    onChange={(value) => set('value', value)}
                    invalid={submitted && issues.some((i) => i.field === 'value')}
                  />
                )}
                <p className="token-form__hint">{tForm('valueHint')}</p>
                {fieldError('value')}
              </label>
            </div>

            <div className="auth-field">
              <span className="auth-field__label">{tForm('color')}</span>
              <ColorPicker value={values.color ?? DEFAULT_TOKEN_COLOR} onChange={(color) => set('color', color)} />
              <p className="token-form__hint">{tForm('colorHint')}</p>
            </div>

            <fieldset className="mode-cards" disabled={locked.kind || pending}>
              <legend className="token-form__legend">{tForm('kind')}</legend>
              <label
                className={['mode-card', values.kind === 'multi_purpose' ? 'is-checked' : ''].filter(Boolean).join(' ')}
                data-testid="token-kind-multi"
              >
                <input
                  type="radio"
                  name="token-kind"
                  checked={values.kind === 'multi_purpose'}
                  onChange={() => setKind('multi_purpose')}
                />
                <span className="mode-card__body">
                  <span className="mode-card__head">
                    <b className="mode-card__name">{tForm('kindMulti.name')}</b>
                    <span className="mode-card__badge is-current">{tForm('kindMulti.badge')}</span>
                  </span>
                  <span className="mode-card__text">{tForm('kindMulti.text')}</span>
                </span>
              </label>
              {showSinglePurpose && (
                <label
                  className={['mode-card', values.kind === 'single_purpose' ? 'is-checked' : ''].filter(Boolean).join(' ')}
                  data-testid="token-kind-single"
                >
                  <input
                    type="radio"
                    name="token-kind"
                    checked={values.kind === 'single_purpose'}
                    onChange={() => setKind('single_purpose')}
                  />
                  <span className="mode-card__body">
                    <span className="mode-card__head">
                      <b className="mode-card__name">{tForm('kindSingle.name')}</b>
                    </span>
                    <span className="mode-card__text">{tForm('kindSingle.text')}</span>
                  </span>
                </label>
              )}
            </fieldset>
            {!showSinglePurpose && <p className="token-form__hint">{tForm('smallBusinessHint')}</p>}
            {fieldError('kind')}

            {values.kind === 'single_purpose' && (
              <label className="auth-field">
                <span>
                  {tForm('vatRate')} <span className="auth-field__req">*</span>
                </span>
                <select
                  className="select"
                  value={values.vatRate === null ? '' : String(values.vatRate)}
                  disabled={locked.vatRate || pending}
                  onChange={(e) => set('vatRate', e.target.value === '' ? null : Number(e.target.value))}
                  data-testid="token-type-rate"
                >
                  {values.vatRate === null && <option value="">{tForm('vatRatePick')}</option>}
                  {rateOptions.map((rate) => (
                    <option key={rate} value={rate}>
                      {formatRate(rate, locale)}
                    </option>
                  ))}
                </select>
                <p className="token-form__hint">{tForm('vatRateHint')}</p>
                {fieldError('vatRate')}
              </label>
            )}

            <label className="auth-field">
              <span>{tForm('event')}</span>
              <select
                className="select"
                value={eventId}
                disabled={restrictionDisabled}
                onChange={(e) => setEvent(e.target.value)}
                data-testid="token-type-event"
              >
                <option value="">{t('allEvents')}</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              <p className="token-form__hint">{tForm('eventHint')}</p>
            </label>

            <div className="auth-field">
              <span className="auth-field__label">{tForm('restriction')}</span>
              <div className="token-form__scope" role="radiogroup" aria-label={tForm('restriction')}>
                <label>
                  <input
                    type="radio"
                    name="token-restriction"
                    checked={!restrict}
                    disabled={restrictionDisabled}
                    onChange={() => setRestriction(false)}
                  />
                  <span>
                    {values.kind === 'single_purpose' && values.vatRate !== null
                      ? tForm('restrictionAllRate', { rate: formatRate(values.vatRate, locale) })
                      : tForm('restrictionAll')}
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="token-restriction"
                    checked={restrict}
                    disabled={restrictionDisabled || !values.eventId}
                    onChange={() => setRestriction(true)}
                    data-testid="token-type-restrict"
                  />
                  <span>{tForm('restrictionSome')}</span>
                </label>
              </div>
              {!values.eventId && <p className="token-form__hint">{tForm('restrictionNeedsEvent')}</p>}

              {restrict && values.eventId && (
                <>
                  {categoriesLoading || productsLoading ? (
                    <p className="token-form__hint">{tCommon('loading')}</p>
                  ) : categories.length === 0 ? (
                    <p className="token-form__hint">{tForm('noCatalog')}</p>
                  ) : (
                    <div className="token-picker" data-testid="token-type-picker">
                      {categories.map((category) => {
                        const categoryChecked = values.allowedCategoryIds.includes(category.id);
                        const inCategory = (products ?? []).filter((p) => p.categoryId === category.id);
                        return (
                          <div key={category.id} className="token-picker__group">
                            <label className="token-picker__item token-picker__item--category">
                              <input
                                type="checkbox"
                                checked={categoryChecked}
                                disabled={restrictionDisabled}
                                onChange={(e) => toggle('allowedCategoryIds', category.id, e.target.checked)}
                              />
                              <span>{tForm('wholeCategory', { name: category.name, count: inCategory.length })}</span>
                            </label>
                            {inCategory.map((product) => (
                              <label key={product.id} className="token-picker__item token-picker__item--product">
                                <input
                                  type="checkbox"
                                  checked={categoryChecked || values.allowedProductIds.includes(product.id)}
                                  disabled={restrictionDisabled || categoryChecked}
                                  onChange={(e) => toggle('allowedProductIds', product.id, e.target.checked)}
                                />
                                <span>{product.name}</span>
                                {vatExempt === false && (
                                  <span className="token-picker__rate">
                                    {formatRate(Number(product.taxRate) || 0, locale)}
                                  </span>
                                )}
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="token-picker__summary">
                    {tForm('selectionSummary', {
                      categories: values.allowedCategoryIds.length,
                      products: affected.length,
                    })}
                  </p>
                </>
              )}
              {fieldError('restriction')}
            </div>

            <SettingToggle
              label={tForm('buyback')}
              hint={tForm('buybackHint')}
              checked={values.buybackAllowed}
              onChange={(checked: boolean) => set('buybackAllowed', checked)}
            />

            <SettingToggle
              label={tForm('isActive')}
              hint={tForm('isActiveHint')}
              checked={values.isActive}
              onChange={(checked: boolean) => set('isActive', checked)}
            />

            <label className="auth-field" style={{ maxWidth: 200 }}>
              <span>{tForm('sortOrder')}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={values.sortOrder}
                onChange={(e) => set('sortOrder', Number(e.target.value) || 0)}
              />
              <p className="token-form__hint">{tForm('sortOrderHint')}</p>
            </label>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={pending}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={pending} data-testid="token-type-submit">
              {pending ? tCommon('saving') : isEditing ? tCommon('save') : tCommon('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
