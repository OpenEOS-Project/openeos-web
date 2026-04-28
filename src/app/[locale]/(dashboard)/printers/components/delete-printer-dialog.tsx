'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { printersApi } from '@/lib/api-client';
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
          <button className="modal__close" type="button" onClick={onClose} aria-label={tCommon('close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
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
            style={{ background: '#d24545', borderColor: '#d24545' }}
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? '...' : tCommon('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
