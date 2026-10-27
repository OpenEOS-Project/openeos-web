'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useDiscoverPrinters } from '@/hooks/use-printers';
import type { PrinterAgent } from '@/types/printer';

interface DiscoverPrintersDialogProps {
  organizationId: string;
  agent: PrinterAgent;
  onClose: () => void;
}

/**
 * Asks the agent to scan again. USB, mDNS and the Windows spooler are always
 * checked; the port-9100 sweep of the local /24 only on request — it takes a
 * moment and some networks don't like it.
 */
export function DiscoverPrintersDialog({ organizationId, agent, onClose }: DiscoverPrintersDialogProps) {
  const t = useTranslations('printers.agents.discover');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const [subnetScan, setSubnetScan] = useState(false);
  const discoverMutation = useDiscoverPrinters(organizationId);

  function handleSubmit() {
    discoverMutation.mutate(
      { deviceId: agent.deviceId, data: { subnetScan } },
      {
        onSuccess: () => {
          toast.success(t('started'));
          onClose();
        },
        onError: (err) => toast.error(apiErrorMessage(err, t('failed'))),
      },
    );
  }

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="discover-printers-title" className="modal__panel--sm">
        <div className="modal__head">
          <h2 id="discover-printers-title">{t('title')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', margin: 0 }}>
              {t('description', { name: agent.name })}
            </p>
            <SettingToggle
              label={t('subnetScan')}
              hint={t('subnetScanHint')}
              checked={subnetScan}
              onChange={setSubnetScan}
            />
            {!agent.isOnline && (
              <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{t('offlineHint')}</p>
            )}
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {tCommon('cancel')}
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSubmit} disabled={discoverMutation.isPending}>
            {discoverMutation.isPending ? '…' : t('start')}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}
