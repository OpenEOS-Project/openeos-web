'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useBulkCreateWaiters } from '@/hooks/use-waiters';
import { WAITER_BULK_MAX, parseWaiterList } from '@/lib/waiters';
import type { Event } from '@/types/event';
import { WAITER_ROLES, type WaiterRole, type WaiterWithPin } from '@/types/waiter';

interface WaitersBulkModalProps {
  organizationId: string;
  events: Event[];
  /** Laufende Veranstaltung: Vorgabe „nur diese Veranstaltung“ (Entscheidung 3). */
  defaultEventId: string | null;
  onClose: () => void;
  onCreated: (waiters: WaiterWithPin[]) => void;
}

/** Massenanlage: Namensliste bzw. CSV `Name;Kurzname;Rolle`, PINs erzeugt. */
export function WaitersBulkModal({ organizationId, events, defaultEventId, onClose, onCreated }: WaitersBulkModalProps) {
  const t = useTranslations('waiters');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const bulk = useBulkCreateWaiters(organizationId);
  const [text, setText] = useState('');
  const [eventId, setEventId] = useState(defaultEventId ?? '');
  const [role, setRole] = useState<WaiterRole>('service');
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseWaiterList(text), [text]);
  const tooMany = parsed.items.length > WAITER_BULK_MAX;
  const canSubmit = parsed.items.length > 0 && parsed.invalid.length === 0 && !tooMany && !bulk.isPending;

  const submit = () => {
    setError(null);
    bulk.mutate(
      {
        eventId: eventId || null,
        role,
        items: parsed.items.map((item) => ({
          name: item.name,
          shortName: item.shortName,
          ...(item.role ? { role: item.role } : {}),
        })),
      },
      {
        onSuccess: (created) => {
          onClose();
          onCreated(created);
        },
        onError: (err) => setError(apiErrorMessage(err, tCommon('saveFailed'))),
      },
    );
  };

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="waiters-bulk-title" className="modal__panel--md">
        <div className="modal__head">
          <h2 id="waiters-bulk-title">{t('bulk.title')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) submit();
          }}
        >
          <div className="modal__body waiters-form">
            <p className="waiters-form__hint">{t('bulk.description')}</p>
            <div className="field-row">
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
              <label className="auth-field">
                <span>{t('bulk.role')}</span>
                <select className="select" value={role} onChange={(e) => setRole(e.target.value as WaiterRole)}>
                  {WAITER_ROLES.map((value) => (
                    <option key={value} value={value}>
                      {t(`roles.${value}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="auth-field">
              <span>{t('bulk.names')}</span>
              <textarea
                className="input waiters-bulk__text"
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('bulk.placeholder')}
                autoFocus
              />
            </label>
            <p className="waiters-bulk__summary" role="status" data-testid="waiters-bulk-summary">
              {t('bulk.recognized', { count: parsed.items.length })}
              {parsed.duplicates.length > 0 && ` · ${t('bulk.duplicates', { count: parsed.duplicates.length })}`}
              {parsed.invalid.length > 0 && ` · ${t('bulk.invalid', { lines: parsed.invalid.join(', ') })}`}
              {tooMany && ` · ${t('bulk.tooMany', { max: WAITER_BULK_MAX })}`}
            </p>
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
            <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
              {bulk.isPending ? tCommon('saving') : t('bulk.submit', { count: parsed.items.length })}
            </button>
          </div>
        </form>
      </ModalPanel>
    </div>
  );
}
