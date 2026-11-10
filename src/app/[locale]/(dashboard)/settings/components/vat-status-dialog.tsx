'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { ConfirmDialog, useRefreshCurrentOrganization } from '@/components/shared/operating-mode-notices';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { organizationsApi } from '@/lib/api-client';

interface VatStatusDialogProps {
  organizationId: string;
  /** Neuer Status: true = Kleinunternehmer, false = umsatzsteuerpflichtig. */
  vatExempt: boolean;
  onClose: () => void;
}

/**
 * Steuerstatus mit Cloud-TSE wechseln: OpenEOS erstellt zuerst einen
 * Kassenabschluss, damit alle bisherigen Vorgänge mit dem alten Status
 * abgeschlossen sind (DSFinV-K), dann gilt ab sofort der neue.
 */
export function VatStatusDialog({ organizationId, vatExempt, onClose }: VatStatusDialogProps) {
  const t = useTranslations('settings.organizationGeneral.vatStatus');
  const apiErrorMessage = useApiErrorMessage();
  const refresh = useRefreshCurrentOrganization();
  const direction = vatExempt ? 'toExempt' : 'toLiable';

  const change = useMutation({
    mutationFn: async () => (await organizationsApi.changeVatStatus(organizationId, vatExempt)).data,
    onSuccess: async (result) => {
      await refresh().catch(() => undefined);
      const numbers = result.closings.map((closing) => `Z${closing.zNr}`).join(', ');
      if (!result.changed) toast.success(t('unchanged'));
      else if (numbers) toast.success(t('changedWithClosing', { numbers }));
      else toast.success(t('changed'));
      onClose();
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('failed'))),
  });

  return (
    <ConfirmDialog
      id="vat-status-dialog"
      title={t(`${direction}.title`)}
      confirmLabel={t(`${direction}.confirm`)}
      pending={change.isPending}
      onConfirm={() => change.mutate()}
      onCancel={onClose}
    >
      <p>{t('closingFirst')}</p>
      <p>{t(`${direction}.effect`)}</p>
      <p>{t('limits')}</p>
      <p className="mode-dialog__muted">{t('logged')}</p>
    </ConfirmDialog>
  );
}
