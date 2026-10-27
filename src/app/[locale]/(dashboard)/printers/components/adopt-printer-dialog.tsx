'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useAdoptDiscoveredPrinter } from '@/hooks/use-printers';
import type { DiscoveredPrinter } from '@/types/printer';
import { formatDiscoveredConnection, formatDiscoveredModel } from '@/utils/printer-connection';

import { FormRow, PrinterSettingsFields, type PrinterSettings } from './printer-settings-fields';

interface AdoptPrinterDialogProps {
  organizationId: string;
  deviceId: string;
  discovered: DiscoveredPrinter;
  onClose: () => void;
}

/**
 * Turns a discovered printer into a usable one. The connection comes from
 * what the agent found; the user only names it and says what it prints.
 */
export function AdoptPrinterDialog({ organizationId, deviceId, discovered, onClose }: AdoptPrinterDialogProps) {
  const t = useTranslations('printers');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();

  const [name, setName] = useState(discovered.displayName);
  const [settings, setSettings] = useState<PrinterSettings>({
    type: 'receipt',
    paperWidth: 80,
    hasCashDrawer: false,
  });

  const adoptMutation = useAdoptDiscoveredPrinter(organizationId);
  const isValid = name.trim().length > 0;

  const model = formatDiscoveredModel(discovered.details);
  const connection = formatDiscoveredConnection(discovered);

  function handleSubmit() {
    if (!isValid) return;
    adoptMutation.mutate(
      { deviceId, discoveredId: discovered.id, data: { name: name.trim(), ...settings } },
      {
        onSuccess: () => {
          toast.success(t('adopt.success', { name: name.trim() }));
          onClose();
        },
        onError: (err) => {
          toast.error(apiErrorMessage(err, t('adopt.failed')));
          onClose();
        },
      },
    );
  }

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="adopt-printer-title" className="modal__panel--md">
        <div className="modal__head">
          <h2 id="adopt-printer-title">{t('adopt.title')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="modal__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{discovered.displayName}</span>
                <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                  {t(`connectionTypes.${discovered.connectionType}`)}
                  {connection ? ` · ${connection}` : ''}
                  {model && model !== discovered.displayName ? ` · ${model}` : ''}
                </span>
              </div>

              <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', margin: 0 }}>
                {t('adopt.description')}
              </p>

              <FormRow label={t('form.name')}>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                  autoFocus
                />
              </FormRow>

              <PrinterSettingsFields value={settings} onChange={setSettings} />
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={!isValid || adoptMutation.isPending}>
              {adoptMutation.isPending ? tCommon('saving') : t('discovered.adopt')}
            </button>
          </div>
        </form>
      </ModalPanel>
    </div>
  );
}
