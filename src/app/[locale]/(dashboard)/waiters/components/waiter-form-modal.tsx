'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { ColorPicker } from '@/components/shared/color-picker';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCreateWaiter, useUpdateWaiter } from '@/hooks/use-waiters';
import { WAITER_COLORS, effectivePermissions, employeeFlagPatch, permissionOverrides } from '@/lib/waiters';
import type { Event } from '@/types/event';
import {
  WAITER_PERMISSION_KEYS,
  WAITER_ROLES,
  type Waiter,
  type WaiterPermissionKey,
  type WaiterRole,
  type WaiterWithPin,
} from '@/types/waiter';

import '@/styles/device-settings.css';

interface WaiterFormModalProps {
  organizationId: string;
  /** `null` = neue Bedienung. */
  waiter: Waiter | null;
  events: Event[];
  defaultEventId: string | null;
  onClose: () => void;
  onCreated: (waiter: WaiterWithPin) => void;
}

export function WaiterFormModal({ organizationId, waiter, events, defaultEventId, onClose, onCreated }: WaiterFormModalProps) {
  const t = useTranslations('waiters');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const create = useCreateWaiter(organizationId);
  const update = useUpdateWaiter(organizationId);
  const isEdit = !!waiter;

  const [name, setName] = useState(waiter?.name ?? '');
  const [shortName, setShortName] = useState(waiter?.shortName ?? '');
  const [color, setColor] = useState<string>(waiter?.color ?? WAITER_COLORS[0]);
  const [role, setRole] = useState<WaiterRole>(waiter?.role ?? 'service');
  const [rights, setRights] = useState<Record<WaiterPermissionKey, boolean>>(
    effectivePermissions(waiter?.role ?? 'service', waiter?.permissions),
  );
  const [eventId, setEventId] = useState<string>(waiter ? (waiter.eventId ?? '') : (defaultEventId ?? ''));
  const [isEmployee, setIsEmployee] = useState(waiter?.isEmployee === true);
  const [ownPin, setOwnPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const changeRole = (next: WaiterRole) => {
    setRole(next);
    // Rolle wechseln setzt die Schalter auf die Vorgabe der Rolle.
    setRights(effectivePermissions(next, {}));
  };

  const pinInvalid = ownPin !== '' && !/^\d{4,6}$/.test(ownPin);
  const busy = create.isPending || update.isPending;

  const submit = () => {
    setError(null);
    if (!name.trim()) {
      setError(t('form.nameRequired'));
      return;
    }
    if (pinInvalid) {
      setError(t('form.pinFormat'));
      return;
    }
    const data = {
      name: name.trim(),
      shortName: shortName.trim() || null,
      color,
      role,
      permissions: permissionOverrides(role, rights),
      eventId: eventId || null,
      ...employeeFlagPatch(waiter?.isEmployee, isEmployee),
    };
    if (isEdit) {
      update.mutate(
        { id: waiter.id, data },
        {
          onSuccess: () => {
            toast.success(t('toast.saved', { name: data.name }));
            onClose();
          },
          onError: (err) => setError(apiErrorMessage(err, tCommon('saveFailed'))),
        },
      );
    } else {
      create.mutate(
        { ...data, ...(ownPin ? { pin: ownPin } : {}) },
        {
          onSuccess: (created) => {
            onClose();
            onCreated(created);
          },
          onError: (err) => setError(apiErrorMessage(err, tCommon('saveFailed'))),
        },
      );
    }
  };

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="waiter-form-title" className="modal__panel--md">
        <div className="modal__head">
          <h2 id="waiter-form-title">{isEdit ? t('form.editTitle') : t('form.createTitle')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="modal__body waiters-form">
            <label className="auth-field">
              <span>{t('form.name')}</span>
              <input
                className="input"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('form.namePlaceholder')}
                autoFocus
                required
              />
            </label>
            <div className="field-row">
              <label className="auth-field">
                <span>{t('form.shortName')}</span>
                <input
                  className="input"
                  value={shortName}
                  maxLength={12}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder={t('form.shortNamePlaceholder')}
                />
              </label>
              <label className="auth-field">
                <span>{t('form.scope')}</span>
                <select className="select" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                  <option value="">{t('scope.organization')}</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {t('filter.event', { name: event.name })}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="auth-field">
              <span>{t('form.color')}</span>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <fieldset className="waiters-form__roles">
              <legend>{t('form.role')}</legend>
              {WAITER_ROLES.map((value) => (
                <label key={value} className="device-settings__choice">
                  <input type="radio" name="waiter-role" value={value} checked={role === value} onChange={() => changeRole(value)} />
                  <span>
                    <b>{t(`roles.${value}`)}</b>
                    <small>{t(`roles.${value}Description`)}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="waiters-form__rights">
              <legend>{t('form.rights')}</legend>
              {WAITER_PERMISSION_KEYS.map((key) => (
                <label key={key} className="waiters-form__right">
                  <input
                    type="checkbox"
                    checked={rights[key]}
                    onChange={(e) => setRights({ ...rights, [key]: e.target.checked })}
                  />
                  <span>
                    <b>{t(`rights.${key}`)}</b>
                    <small>{t(`rights.${key}Hint`)}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="waiters-form__rights">
              <legend>{t('form.employment')}</legend>
              <label className="waiters-form__right">
                <input
                  type="checkbox"
                  checked={isEmployee}
                  onChange={(e) => setIsEmployee(e.target.checked)}
                  data-testid="waiter-is-employee"
                />
                <span>
                  <b>{t('form.isEmployee')}</b>
                  <small>{t('form.isEmployeeHint')}</small>
                </span>
              </label>
            </fieldset>
            {!isEdit && (
              <label className="auth-field">
                <span>{t('form.ownPin')}</span>
                <input
                  className="input mono"
                  inputMode="numeric"
                  autoComplete="off"
                  value={ownPin}
                  maxLength={6}
                  onChange={(e) => setOwnPin(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('form.ownPinPlaceholder')}
                  aria-invalid={pinInvalid || undefined}
                />
                <small className="waiters-form__hint">{t('form.ownPinHint')}</small>
              </label>
            )}
            {error && (
              <p className="waiters-form__error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? tCommon('saving') : isEdit ? tCommon('save') : t('form.createSubmit')}
            </button>
          </div>
        </form>
      </ModalPanel>
    </div>
  );
}
