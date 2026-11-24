'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@openeos/ui';

import '@/styles/event-copy.css';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useDuplicateEvent } from '@/hooks/use-events';
import { suggestCopyEnd, suggestCopyName } from '@/lib/event-copy';
import { toDayKey, toIsoAtMidnight } from '@/lib/event-schedule';
import type { Event } from '@/types';
import type { DuplicateEventResult } from '@/types/event';

interface EventDuplicateDialogProps {
  event: Event;
  organizationId: string;
  onClose: () => void;
  onDuplicated: (result: DuplicateEventResult) => void;
}

/** „Veranstaltung duplizieren“: Name und Zeitraum, der Rest kommt vom Server. */
export function EventDuplicateDialog({ event, organizationId, onClose, onDuplicated }: EventDuplicateDialogProps) {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const duplicate = useDuplicateEvent();
  const sourceStart = event.startDate ? toDayKey(event.startDate) : '';
  const sourceEnd = event.endDate ? toDayKey(event.endDate) : sourceStart;

  const [name, setName] = useState(() => suggestCopyName(event.name, t('duplicate.suffix')));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [copyStock, setCopyStock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeStart = (value: string) => {
    setStartDate(value);
    // Die Dauer der Vorlage bleibt erhalten.
    setEndDate(value ? suggestCopyEnd(sourceStart, sourceEnd, value) : '');
  };

  const invalidRange = !!endDate && !!startDate && endDate < startDate;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (duplicate.isPending || !startDate || name.trim().length < 2 || invalidRange) return;
    setError(null);
    try {
      const result = await duplicate.mutateAsync({
        organizationId,
        id: event.id,
        data: {
          name: name.trim(),
          startDate: toIsoAtMidnight(startDate),
          endDate: toIsoAtMidnight(endDate || startDate),
          copyStock,
        },
      });
      onDuplicated(result);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="modal__overlay" onClick={duplicate.isPending ? undefined : onClose}>
      <ModalPanel titleId="event-duplicate-title" className="modal__panel--md">
        <div className="modal__head">
          <h2 id="event-duplicate-title">{t('duplicate.title')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="modal__body event-copy-dialog__body">
            <label className="auth-field">
              <span>
                {t('form.name')} <span className="auth-field__req">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={200}
              />
            </label>
            <div className="field-row">
              <label className="auth-field">
                <span>
                  {t('form.startDate')} <span className="auth-field__req">*</span>
                </span>
                <input type="date" value={startDate} onChange={(e) => changeStart(e.target.value)} required />
              </label>
              <label className="auth-field">
                <span>{t('form.endDate')}</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
            </div>
            {invalidRange && (
              <span role="alert" className="auth-field__error">
                {t('form.endBeforeStart')}
              </span>
            )}

            <div>
              <p className="event-copy-dialog__hint">{t('duplicate.intro', { name: event.name })}</p>
              <ul className="event-copy-dialog__list">
                <li>{t('duplicate.itemCatalog')}</li>
                <li>{t('duplicate.itemSettings')}</li>
                <li>{t('duplicate.itemShifts')}</li>
                <li>{t('duplicate.itemStaff')}</li>
              </ul>
              <p className="event-copy-dialog__hint">{t('duplicate.never')}</p>
            </div>

            <Checkbox checked={copyStock} onChange={(e) => setCopyStock(e.target.checked)}>
              {t('duplicate.copyStock')}
            </Checkbox>

            {error && (
              <div role="alert" className="event-copy-dialog__error">
                {error}
              </div>
            )}
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={duplicate.isPending}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={duplicate.isPending || !startDate || invalidRange}>
              {duplicate.isPending ? tCommon('saving') : t('duplicate.submit')}
            </button>
          </div>
        </form>
      </ModalPanel>
    </div>
  );
}
