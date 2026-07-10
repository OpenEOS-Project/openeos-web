'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { printersApi } from '@/lib/api-client';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import type { Printer } from '@/types/printer';

interface DeletePrinterDialogProps {
  printer: Printer;
  onClose: () => void;
}

export function DeletePrinterDialog({ printer, onClose }: DeletePrinterDialogProps) {
  const t = useTranslations('printers');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const deleteMutation = useMutation({
    mutationFn: () => printersApi.delete(organizationId!, printer.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers', organizationId] });
      onClose();
    },
  });

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{t('deletePrinter')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', marginBottom: 16 }}>
            {t('deleteConfirm', { name: printer.name })}
          </p>
          <div style={{
            background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
            borderRadius: 10, padding: 12, textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{printer.name}</p>
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
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? tCommon('deleting') : tCommon('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
