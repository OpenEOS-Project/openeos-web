'use client';

import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useDeletePrinter } from '@/hooks/use-printers';
import type { Printer } from '@/types/printer';

interface DeletePrinterDialogProps {
  organizationId: string;
  printer: Printer;
  onClose: () => void;
}

export function DeletePrinterDialog({ organizationId, printer, onClose }: DeletePrinterDialogProps) {
  const t = useTranslations('printers');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const deleteMutation = useDeletePrinter(organizationId);

  function handleDelete() {
    deleteMutation.mutate(printer.id, {
      onSuccess: () => {
        toast.success(t('deleted', { name: printer.name }));
        onClose();
      },
      onError: (err) => toast.error(apiErrorMessage(err, t('deleteFailed'))),
    });
  }

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="delete-printer-dialog-title" className="modal__panel--sm">
        <div className="modal__head">
          <h2 id="delete-printer-dialog-title">{t('deletePrinter')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', marginBottom: 16 }}>
            {t('deleteConfirm', { name: printer.name })}
          </p>
          <div
            style={{
              background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 13,
              color: 'color-mix(in oklab, var(--ink) 70%, transparent)',
            }}
          >
            {t('deleteHint')}
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? tCommon('deleting') : tCommon('delete')}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}
