'use client';

import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useRemoveWaiter } from '@/hooks/use-waiters';
import type { Waiter } from '@/types/waiter';

interface WaiterDeleteDialogProps {
  organizationId: string;
  waiter: Waiter;
  onClose: () => void;
}

/** Löschen: ohne Buchungen weg, sonst deaktiviert und anonymisiert. */
export function WaiterDeleteDialog({ organizationId, waiter, onClose }: WaiterDeleteDialogProps) {
  const t = useTranslations('waiters');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const remove = useRemoveWaiter(organizationId);

  const confirm = () =>
    remove.mutate(waiter.id, {
      onSuccess: (result) => {
        toast.success(result.deleted ? t('toast.deleted', { name: waiter.name }) : t('toast.anonymized', { name: waiter.name }));
        onClose();
      },
      onError: (error) => toast.error(apiErrorMessage(error, tCommon('saveFailed'))),
    });

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="waiter-delete-title" className="modal__panel--sm">
        <div className="modal__head">
          <h2 id="waiter-delete-title">{t('delete.title', { name: waiter.name })}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="modal__body">
          <p className="waiters-form__hint">{t('delete.text')}</p>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={confirm}
            disabled={remove.isPending}
          >
            {remove.isPending ? tCommon('deleting') : tCommon('delete')}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}
