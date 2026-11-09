'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Banner, Icon, Skeleton } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { toast } from '@/components/shared/toast';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useCreateWebhook, useUpdateWebhook, useWebhookInfo } from '@/hooks/use-webhooks';

import {
  checkWebhookUrl,
  eventTypesWithAmounts,
  groupSelectionState,
  groupWebhookEventTypes,
  toggleEventTypes,
  WEBHOOK_DESCRIPTION_MAX_LENGTH,
  WEBHOOK_URL_MAX_LENGTH,
  webhookUrlErrorReason,
  type WebhookUrlCheck,
} from '@/lib/webhooks';

import type {
  UpdateWebhookInput,
  WebhookEndpoint,
  WebhookEndpointWithSecret,
  WebhookEventType,
} from '@/types/webhook';

import { useEventTypeLabel } from './webhook-ui';
import { WebhookSecretReveal } from './webhook-secret-reveal';

interface WebhookFormDialogProps {
  organizationId: string;
  /** Ohne Endpunkt: anlegen. */
  endpoint?: WebhookEndpoint | null;
  onClose: () => void;
}

/**
 * Webhook anlegen oder bearbeiten. Beim Anlegen folgt die einmalige Anzeige
 * des Secrets; dort schließt nur „Fertig“ — kein Escape, kein Klick
 * daneben —, damit es nicht ungesehen verschwindet.
 */
export function WebhookFormDialog({ organizationId, endpoint, onClose }: WebhookFormDialogProps) {
  const t = useTranslations('settings.organizationWebhooks.form');
  const tSecret = useTranslations('settings.organizationWebhooks.secret');
  const tRoot = useTranslations('settings.organizationWebhooks');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatDateTime } = useLocaleFormat();
  const info = useWebhookInfo(organizationId);
  const create = useCreateWebhook(organizationId);
  const update = useUpdateWebhook(organizationId);
  const eventLabel = useEventTypeLabel(info.data?.eventTypes);

  const editing = !!endpoint;
  const [url, setUrl] = useState(endpoint?.url ?? '');
  const [description, setDescription] = useState(endpoint?.description ?? '');
  const [eventTypes, setEventTypes] = useState<WebhookEventType[]>(endpoint?.eventTypes ?? []);
  const [active, setActive] = useState(endpoint?.active ?? true);
  const [includeGuestData, setIncludeGuestData] = useState(endpoint?.includeGuestData ?? false);
  const [includeTestOrders, setIncludeTestOrders] = useState(endpoint?.includeTestOrders ?? false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverUrlError, setServerUrlError] = useState<WebhookUrlCheck | null>(null);
  const [created, setCreated] = useState<WebhookEndpointWithSecret | null>(null);

  const pending = create.isPending || update.isPending;
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

  const typeInfos = useMemo(() => info.data?.eventTypes ?? [], [info.data]);
  const groups = useMemo(() => groupWebhookEventTypes(typeInfos), [typeInfos]);
  const order = useMemo(() => typeInfos.map((info) => info.type), [typeInfos]);
  const withAmounts = eventTypesWithAmounts(eventTypes, typeInfos);

  const urlCheck = checkWebhookUrl(url);
  const urlError = (submitted ? urlCheck : null) ?? serverUrlError;
  const noEvents = eventTypes.length === 0;

  const setTypes = (types: WebhookEventType[], checked: boolean) =>
    setEventTypes((current) => toggleEventTypes(current, types, checked, order));

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    setServerUrlError(null);
    if (urlCheck || noEvents) return;

    const onError = (err: unknown) => {
      const reason = webhookUrlErrorReason(err);
      if (reason) setServerUrlError(reason);
      else setError(apiErrorMessage(err, tCommon('error')));
    };
    const trimmedDescription = description.trim();

    if (endpoint) {
      const input: UpdateWebhookInput = {};
      if (url.trim() !== endpoint.url) input.url = url.trim();
      if (trimmedDescription !== (endpoint.description ?? '')) input.description = trimmedDescription || null;
      if (eventTypes.join() !== endpoint.eventTypes.join()) input.eventTypes = eventTypes;
      if (active !== endpoint.active) input.active = active;
      if (includeGuestData !== endpoint.includeGuestData) input.includeGuestData = includeGuestData;
      if (includeTestOrders !== endpoint.includeTestOrders) input.includeTestOrders = includeTestOrders;
      if (Object.keys(input).length === 0) {
        onClose();
        return;
      }
      update.mutate(
        { id: endpoint.id, input },
        {
          onSuccess: () => {
            toast.success(tRoot('updated'));
            onClose();
          },
          onError,
        }
      );
      return;
    }

    create.mutate(
      {
        url: url.trim(),
        description: trimmedDescription || null,
        eventTypes,
        active,
        includeGuestData,
        includeTestOrders,
      },
      { onSuccess: (result) => setCreated(result), onError }
    );
  };

  const autoDisabled = !!endpoint?.disabledReason && !active;

  return (
    <div className="modal__overlay" onClick={close}>
      <ModalPanel titleId="webhook-form-title" className="modal__panel--lg">
        <div className="modal__head">
          <h2 id="webhook-form-title">
            {created ? tSecret('createdTitle') : editing ? t('editTitle') : t('createTitle')}
          </h2>
          {!created && <DialogCloseButton onClick={close} />}
        </div>

        {created ? (
          <>
            <div className="modal__body">
              <WebhookSecretReveal endpoint={created} />
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                {tSecret('done')}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className="modal__body">
              <div className="api-token-form">
                {error && (
                  <Banner tone="danger" icon={<Icon name="alert" />}>
                    {error}
                  </Banner>
                )}

                <label className={`auth-field${urlError ? ' auth-field--error' : ''}`}>
                  <span>
                    {t('url')} <span className="auth-field__req">*</span>
                  </span>
                  <input
                    type="url"
                    inputMode="url"
                    value={url}
                    maxLength={WEBHOOK_URL_MAX_LENGTH}
                    autoFocus={!editing}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder={t('urlPlaceholder')}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setServerUrlError(null);
                    }}
                    disabled={pending}
                    className="webhook-url-input"
                  />
                  {urlError ? (
                    <span role="alert" className="auth-field__error">
                      {t(`urlErrors.${urlError}`)}
                    </span>
                  ) : (
                    <span className="auth-field__hint">{t('urlHint')}</span>
                  )}
                </label>

                <label className="auth-field">
                  <span>
                    {t('description')} <span className="webhook-optional">({t('optional')})</span>
                  </span>
                  <input
                    type="text"
                    value={description}
                    maxLength={WEBHOOK_DESCRIPTION_MAX_LENGTH}
                    placeholder={t('descriptionPlaceholder')}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={pending}
                  />
                </label>

                <fieldset className="webhook-events" disabled={pending}>
                  <legend className="auth-field__label webhook-events__legend">
                    <span>
                      {t('events')} <span className="auth-field__req">*</span>
                    </span>
                    <span className="webhook-events__count">{t('eventsSelected', { count: eventTypes.length })}</span>
                  </legend>

                  {info.isLoading ? (
                    <Skeleton height={160} />
                  ) : info.isError ? (
                    <Banner tone="danger" icon={<Icon name="alert" />}>
                      {t('infoError')}
                    </Banner>
                  ) : (
                    groups.map(({ group, types }) => {
                      const groupTypes = types.map((type) => type.type);
                      const state = groupSelectionState(eventTypes, groupTypes);
                      const groupLabel = t.has(`groups.${group}`) ? t(`groups.${group}`) : group;
                      return (
                        <div key={group} className="webhook-events__group" role="group" aria-label={groupLabel}>
                          <div className="webhook-events__head">
                            <span className="webhook-events__title">{groupLabel}</span>
                            <button
                              type="button"
                              className="webhook-events__all"
                              onClick={() => setTypes(groupTypes, state !== 'all')}
                              aria-label={
                                state === 'all'
                                  ? t('selectNoneIn', { group: groupLabel })
                                  : t('selectAllIn', { group: groupLabel })
                              }
                            >
                              {state === 'all' ? t('selectNone') : t('selectAll')}
                            </button>
                          </div>
                          {types.map((type) => {
                            const checked = eventTypes.includes(type.type);
                            return (
                              <label
                                key={type.type}
                                className={`api-token-form__scope${checked ? ' is-checked' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => setTypes([type.type], e.target.checked)}
                                />
                                <span className="api-token-form__scope-text">
                                  <span className="api-token-form__scope-name">
                                    {eventLabel(type.type)}
                                    {type.containsAmounts && (
                                      <span className="webhook-amounts-tag">{t('amountsTag')}</span>
                                    )}
                                  </span>
                                  <span className="api-token-form__scope-code">{type.type}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })
                  )}

                  {submitted && noEvents && (
                    <span role="alert" className="auth-field__error">
                      {t('eventsRequired')}
                    </span>
                  )}
                  {withAmounts.length > 0 && <p className="api-token-form__hint">{t('amountsNote')}</p>}
                </fieldset>

                <div className="webhook-options">
                  <span className="auth-field__label">{t('options')}</span>
                  <SettingToggle
                    label={t('active')}
                    hint={
                      autoDisabled && endpoint?.disabledAt
                        ? t('autoDisabledHint', { date: formatDateTime(endpoint.disabledAt) })
                        : t('activeHint')
                    }
                    checked={active}
                    onChange={setActive}
                    disabled={pending}
                  />
                  <SettingToggle
                    label={t('guestData')}
                    hint={t('guestDataHint')}
                    checked={includeGuestData}
                    onChange={setIncludeGuestData}
                    disabled={pending}
                  />
                  <SettingToggle
                    label={t('testOrders')}
                    hint={t('testOrdersHint')}
                    checked={includeTestOrders}
                    onChange={setIncludeTestOrders}
                    disabled={pending}
                  />
                </div>
              </div>
            </div>

            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={pending}>
                {tCommon('cancel')}
              </button>
              <button type="submit" className="btn btn--primary" disabled={pending || info.isLoading}>
                {pending ? t('pending') : editing ? t('submitEdit') : t('submitCreate')}
              </button>
            </div>
          </form>
        )}
      </ModalPanel>
    </div>
  );
}
