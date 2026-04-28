'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '@/lib/api-client';
import { useCreatePrinter, useUpdatePrinter } from '@/hooks/use-printers';
import type { Printer, CreatePrinterData, UpdatePrinterData } from '@/types/printer';
import type { Device } from '@/types/device';

interface PrinterFormModalProps {
  organizationId: string;
  printer?: Printer | null;
  onClose: () => void;
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</label>
      {children}
    </div>
  );
}

export function PrinterFormModal({ organizationId, printer, onClose }: PrinterFormModalProps) {
  const t = useTranslations('printers');
  const tCommon = useTranslations('common');
  const isEdit = !!printer;

  const [name, setName] = useState(printer?.name ?? '');
  const [type, setType] = useState<'receipt' | 'kitchen' | 'label'>(printer?.type ?? 'receipt');
  const [connectionType, setConnectionType] = useState<'network' | 'usb' | 'bluetooth'>(printer?.connectionType ?? 'network');
  const [ipAddress, setIpAddress] = useState((printer?.connectionConfig?.host as string) ?? '');
  const [port, setPort] = useState(String((printer?.connectionConfig?.port as number) ?? 9100));
  const [usbVendorId, setUsbVendorId] = useState((printer?.connectionConfig?.vendorId as string) ?? '');
  const [usbProductId, setUsbProductId] = useState((printer?.connectionConfig?.productId as string) ?? '');
  const [paperWidth, setPaperWidth] = useState<number>(printer?.paperWidth ?? 80);
  const [hasCashDrawer, setHasCashDrawer] = useState(printer?.hasCashDrawer ?? false);
  const [deviceId, setDeviceId] = useState<string>(printer?.deviceId ?? '');

  const createMutation = useCreatePrinter(organizationId);
  const updateMutation = useUpdatePrinter(organizationId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const { data: devicesData } = useQuery({
    queryKey: ['devices', organizationId],
    queryFn: () => devicesApi.list(organizationId),
    enabled: !!organizationId,
  });

  const printerAgentDevices = (devicesData?.data ?? []).filter(
    (d: Device) => d.type === 'printer_agent' && d.status === 'verified'
  );

  function buildConnectionConfig(): Record<string, unknown> {
    if (connectionType === 'network') return { host: ipAddress, port: parseInt(port, 10) || 9100 };
    if (connectionType === 'usb') return { vendorId: usbVendorId, productId: usbProductId };
    return {};
  }

  function handleSubmit() {
    const connectionConfig = buildConnectionConfig();
    if (isEdit && printer) {
      const data: UpdatePrinterData = { name, type, connectionType, connectionConfig, paperWidth, hasCashDrawer, deviceId: deviceId || null };
      updateMutation.mutate({ printerId: printer.id, data }, { onSuccess: () => onClose() });
    } else {
      const data: CreatePrinterData = { name, type, connectionType, connectionConfig, paperWidth, hasCashDrawer, deviceId: deviceId || undefined };
      createMutation.mutate(data, { onSuccess: () => onClose() });
    }
  }

  const isValid = name.trim().length > 0 && (connectionType !== 'network' || ipAddress.trim().length > 0);

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div className="modal__panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{isEdit ? t('editPrinter') : t('addPrinter')}</h2>
          <button className="modal__close" type="button" onClick={onClose} aria-label={tCommon('close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormRow label={t('form.name')}>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('form.namePlaceholder')}
              />
            </FormRow>

            <FormRow label={t('form.type')}>
              <select className="select" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="receipt">{t('types.receipt')}</option>
                <option value="kitchen">{t('types.kitchen')}</option>
                <option value="label">{t('types.label')}</option>
              </select>
            </FormRow>

            <FormRow label={t('form.connectionType')}>
              <select className="select" value={connectionType} onChange={(e) => setConnectionType(e.target.value as typeof connectionType)}>
                <option value="network">{t('connectionTypes.network')}</option>
                <option value="usb">{t('connectionTypes.usb')}</option>
                <option value="bluetooth">{t('connectionTypes.bluetooth')}</option>
              </select>
            </FormRow>

            {connectionType === 'network' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                <FormRow label={t('form.ipAddress')}>
                  <input className="input" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="192.168.1.100" />
                </FormRow>
                <FormRow label={t('form.port')}>
                  <input className="input" value={port} onChange={(e) => setPort(e.target.value)} placeholder="9100" />
                </FormRow>
              </div>
            )}

            {connectionType === 'usb' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormRow label={t('form.usbVendorId')}>
                  <input className="input" value={usbVendorId} onChange={(e) => setUsbVendorId(e.target.value)} placeholder="0x04b8" />
                </FormRow>
                <FormRow label={t('form.usbProductId')}>
                  <input className="input" value={usbProductId} onChange={(e) => setUsbProductId(e.target.value)} placeholder="0x0202" />
                </FormRow>
              </div>
            )}

            <FormRow label={t('form.paperWidth')}>
              <select className="select" value={String(paperWidth)} onChange={(e) => setPaperWidth(Number(e.target.value))}>
                <option value="58">58mm</option>
                <option value="80">80mm</option>
              </select>
            </FormRow>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t('form.hasCashDrawer')}</span>
              <input
                type="checkbox"
                checked={hasCashDrawer}
                onChange={(e) => setHasCashDrawer(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--green-ink)' }}
              />
            </label>

            <FormRow label={t('form.device')}>
              <select
                className="select"
                value={deviceId || '__none__'}
                onChange={(e) => setDeviceId(e.target.value === '__none__' ? '' : e.target.value)}
              >
                <option value="__none__">{t('form.deviceNone')}</option>
                {printerAgentDevices.map((device: Device) => (
                  <option key={device.id} value={device.id}>{device.name}</option>
                ))}
              </select>
            </FormRow>
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
          >
            {isPending ? '...' : tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
