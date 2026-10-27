'use client';

import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useRemovePrinterAgent } from '@/hooks/use-printers';
import type { PrinterAgent } from '@/types/printer';

interface RemoveAgentDialogProps {
  organizationId: string;
  agent: PrinterAgent;
  onClose: () => void;
}

export function RemoveAgentDialog({ organizationId, agent, onClose }: RemoveAgentDialogProps) {
  const t = useTranslations('printers.agents.remove');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const removeMutation = useRemovePrinterAgent(organizationId);

  function handleRemove() {
    removeMutation.mutate(agent.deviceId, {
      onSuccess: () => {
        toast.success(t('success', { name: agent.name }));
        onClose();
      },
      onError: (err) => toast.error(apiErrorMessage(err, t('failed'))),
    });
  }

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="remove-agent-title" className="modal__panel--sm">
        <div className="modal__head">
          <h2 id="remove-agent-title">{t('title')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', marginBottom: 16 }}>
            {t('confirm', { name: agent.name, count: agent.printerCount })}
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
            {t('hint')}
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
            onClick={handleRemove}
            disabled={removeMutation.isPending}
          >
            {removeMutation.isPending ? tCommon('deleting') : t('submit')}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}
