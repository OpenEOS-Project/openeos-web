'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCreatePrinter, useUpdatePrinter } from '@/hooks/use-printers';
import type { Printer, PrinterPaperWidth } from '@/types/printer';
import { isConnectionEditable } from '@/utils/printer-connection';

import { FormRow, PrinterSettingsFields, type PrinterSettings } from './printer-settings-fields';

interface PrinterFormModalProps {
  organizationId: string;
  /** Agent the printer hangs on — required when creating. */
  deviceId: string;
  /** Edit an existing printer; without it the dialog creates a network printer by hand. */
  printer?: Printer | null;
  onClose: () => void;
}

const DEFAULT_PORT = 9100;

function parsePort(value: string): number | null {
  if (value.trim() === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

/**
 * Printer by hand (network only — USB and Windows printers come from the
 * agent's discovery) or edit an existing one. The agent itself can't be
 * changed: a printer stays with the machine it was found on.
 */
export function PrinterFormModal({ organizationId, deviceId, printer, onClose }: PrinterFormModalProps) {
  const t = useTranslations('printers');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const isEdit = !!printer;
  const showConnection = !printer || isConnectionEditable(printer.connectionType);

  const [name, setName] = useState(printer?.name ?? '');
  const [ipAddress, setIpAddress] = useState(printer?.connectionConfig?.ipAddress ?? '');
  const [port, setPort] = useState(
    printer?.connectionConfig?.port ? String(printer.connectionConfig.port) : String(DEFAULT_PORT),
  );
  const [settings, setSettings] = useState<PrinterSettings>({
    type: printer?.type ?? 'receipt',
    paperWidth: (printer?.paperWidth === 58 ? 58 : 80) as PrinterPaperWidth,
    hasCashDrawer: printer?.hasCashDrawer ?? false,
  });
  const [isActive, setIsActive] = useState(printer?.isActive ?? true);

  const createMutation = useCreatePrinter(organizationId);
  const updateMutation = useUpdatePrinter(organizationId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const parsedPort = parsePort(port);
  const isValid =
    name.trim().length > 0 && (!showConnection || (ipAddress.trim().length > 0 && parsedPort !== null));

  function handleSubmit() {
    if (!isValid) return;
    const connectionConfig = showConnection
      ? { ipAddress: ipAddress.trim(), port: parsedPort ?? DEFAULT_PORT }
      : undefined;

    if (isEdit && printer) {
      updateMutation.mutate(
        {
          printerId: printer.id,
          data: { name: name.trim(), ...settings, isActive, ...(connectionConfig ? { connectionConfig } : {}) },
        },
        {
          onSuccess: () => {
            toast.success(t('form.saved'));
            onClose();
          },
          onError: (err) => toast.error(apiErrorMessage(err, tCommon('saveFailed'))),
        },
      );
      return;
    }

    createMutation.mutate(
      { deviceId, name: name.trim(), ...settings, connectionConfig: connectionConfig! },
      {
        onSuccess: () => {
          toast.success(t('form.created'));
          onClose();
        },
        onError: (err) => toast.error(apiErrorMessage(err, tCommon('saveFailed'))),
      },
    );
  }

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="printer-form-title" className="modal__panel--md">
        <div className="modal__head">
          <h2 id="printer-form-title">{isEdit ? t('editPrinter') : t('addManual.title')}</h2>
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
              {!isEdit && (
                <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', margin: 0 }}>
                  {t('addManual.description')}
                </p>
              )}

              <FormRow label={t('form.name')}>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                  autoFocus
                />
              </FormRow>

              {showConnection && (
                <div className="field-row field-row--narrow-end">
                  <FormRow label={t('form.ipAddress')}>
                    <input
                      className="input"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="192.168.1.100"
                      inputMode="decimal"
                      autoComplete="off"
                    />
                  </FormRow>
                  <FormRow label={t('form.port')}>
                    <input
                      className="input"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder={String(DEFAULT_PORT)}
                      inputMode="numeric"
                      aria-invalid={parsedPort === null}
                    />
                  </FormRow>
                </div>
              )}

              {isEdit && printer && !showConnection && (
                <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', margin: 0 }}>
                  {t('form.connectionFixed', { kind: t(`connectionTypes.${printer.connectionType}`) })}
                </p>
              )}

              <PrinterSettingsFields value={settings} onChange={setSettings} />

              {isEdit && (
                <SettingToggle
                  label={t('form.isActive')}
                  hint={t('form.isActiveHint')}
                  checked={isActive}
                  onChange={setIsActive}
                />
              )}
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={!isValid || isPending}>
              {isPending ? tCommon('saving') : isEdit ? tCommon('save') : t('addManual.submit')}
            </button>
          </div>
        </form>
      </ModalPanel>
    </div>
  );
}
