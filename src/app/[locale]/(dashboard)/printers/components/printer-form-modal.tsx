'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Select } from '@/components/ui/select/select';
import { Label } from '@/components/ui/input/label';
import { Toggle } from '@/components/ui/toggle/toggle';
import { devicesApi } from '@/lib/api-client';
import { useCreatePrinter, useUpdatePrinter } from '@/hooks/use-printers';
import type { Printer, CreatePrinterData, UpdatePrinterData } from '@/types/printer';
import type { Device } from '@/types/device';

interface PrinterFormModalProps {
  organizationId: string;
  printer?: Printer | null;
  onClose: () => void;
}

export function PrinterFormModal({ organizationId, printer, onClose }: PrinterFormModalProps) {
  const t = useTranslations('printers');
  const tCommon = useTranslations('common');
  const isEdit = !!printer;

  const [name, setName] = useState(printer?.name ?? '');
  const [type, setType] = useState<'receipt' | 'kitchen' | 'label'>(printer?.type ?? 'receipt');
  const [connectionType, setConnectionType] = useState<'network' | 'usb' | 'bluetooth'>(
    printer?.connectionType ?? 'network'
  );
  const [ipAddress, setIpAddress] = useState(
    (printer?.connectionConfig?.host as string) ?? ''
  );
  const [port, setPort] = useState(
    String((printer?.connectionConfig?.port as number) ?? 9100)
  );
  const [usbVendorId, setUsbVendorId] = useState(
    (printer?.connectionConfig?.vendorId as string) ?? ''
  );
  const [usbProductId, setUsbProductId] = useState(
    (printer?.connectionConfig?.productId as string) ?? ''
  );
  const [paperWidth, setPaperWidth] = useState<number>(printer?.paperWidth ?? 80);
  const [hasCashDrawer, setHasCashDrawer] = useState(printer?.hasCashDrawer ?? false);
  const [deviceId, setDeviceId] = useState<string>(printer?.deviceId ?? '');

  const createMutation = useCreatePrinter(organizationId);
  const updateMutation = useUpdatePrinter(organizationId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Fetch printer_agent devices for the dropdown
  const { data: devicesData } = useQuery({
    queryKey: ['devices', organizationId],
    queryFn: () => devicesApi.list(organizationId),
    enabled: !!organizationId,
  });

  const printerAgentDevices = (devicesData?.data ?? []).filter(
    (d: Device) => d.type === 'printer_agent' && d.status === 'verified'
  );

  function buildConnectionConfig(): Record<string, unknown> {
    if (connectionType === 'network') {
      return { host: ipAddress, port: parseInt(port, 10) || 9100 };
    }
    if (connectionType === 'usb') {
      return { vendorId: usbVendorId, productId: usbProductId };
    }
    return {};
  }

  function handleSubmit() {
    const connectionConfig = buildConnectionConfig();

    if (isEdit && printer) {
      const data: UpdatePrinterData = {
        name,
        type,
        connectionType,
        connectionConfig,
        paperWidth,
        hasCashDrawer,
        deviceId: deviceId || null,
      };
      updateMutation.mutate(
        { printerId: printer.id, data },
        { onSuccess: () => onClose() }
      );
    } else {
      const data: CreatePrinterData = {
        name,
        type,
        connectionType,
        connectionConfig,
        paperWidth,
        hasCashDrawer,
        deviceId: deviceId || undefined,
      };
      createMutation.mutate(data, { onSuccess: () => onClose() });
    }
  }

  const isValid = name.trim().length > 0 && (
    connectionType !== 'network' || ipAddress.trim().length > 0
  );

  return (
    <DialogModal
      isOpen
      onClose={onClose}
      title={isEdit ? t('editPrinter') : t('addPrinter')}
      size="lg"
    >
      <div className="space-y-4 px-6 py-4">
        {/* Name */}
        <Input
          label={t('form.name')}
          placeholder={t('form.namePlaceholder')}
          value={name}
          onChange={(val) => setName(val)}
        />

        {/* Type */}
        <div className="space-y-1.5">
          <Label>{t('form.type')}</Label>
          <Select
            selectedKey={type}
            onSelectionChange={(key) => setType(key as 'receipt' | 'kitchen' | 'label')}
            aria-label={t('form.type')}
          >
            <Select.Item id="receipt">{t('types.receipt')}</Select.Item>
            <Select.Item id="kitchen">{t('types.kitchen')}</Select.Item>
            <Select.Item id="label">{t('types.label')}</Select.Item>
          </Select>
        </div>

        {/* Connection Type */}
        <div className="space-y-1.5">
          <Label>{t('form.connectionType')}</Label>
          <Select
            selectedKey={connectionType}
            onSelectionChange={(key) => setConnectionType(key as 'network' | 'usb' | 'bluetooth')}
            aria-label={t('form.connectionType')}
          >
            <Select.Item id="network">{t('connectionTypes.network')}</Select.Item>
            <Select.Item id="usb">{t('connectionTypes.usb')}</Select.Item>
            <Select.Item id="bluetooth">{t('connectionTypes.bluetooth')}</Select.Item>
          </Select>
        </div>

        {/* Conditional connection config */}
        {connectionType === 'network' && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.ipAddress')}
              placeholder="192.168.1.100"
              value={ipAddress}
              onChange={(val) => setIpAddress(val)}
            />
            <Input
              label={t('form.port')}
              placeholder="9100"
              value={port}
              onChange={(val) => setPort(val)}
            />
          </div>
        )}

        {connectionType === 'usb' && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.usbVendorId')}
              placeholder="0x04b8"
              value={usbVendorId}
              onChange={(val) => setUsbVendorId(val)}
            />
            <Input
              label={t('form.usbProductId')}
              placeholder="0x0202"
              value={usbProductId}
              onChange={(val) => setUsbProductId(val)}
            />
          </div>
        )}

        {/* Paper Width */}
        <div className="space-y-1.5">
          <Label>{t('form.paperWidth')}</Label>
          <Select
            selectedKey={String(paperWidth)}
            onSelectionChange={(key) => setPaperWidth(Number(key))}
            aria-label={t('form.paperWidth')}
          >
            <Select.Item id="58">58mm</Select.Item>
            <Select.Item id="80">80mm</Select.Item>
          </Select>
        </div>

        {/* Cash Drawer */}
        <div className="flex items-center justify-between">
          <Label>{t('form.hasCashDrawer')}</Label>
          <Toggle isSelected={hasCashDrawer} onChange={setHasCashDrawer} />
        </div>

        {/* Device (Printer Agent) */}
        <div className="space-y-1.5">
          <Label>{t('form.device')}</Label>
          <Select
            selectedKey={deviceId || '__none__'}
            onSelectionChange={(key) => setDeviceId(key === '__none__' ? '' : String(key))}
            aria-label={t('form.device')}
          >
            <Select.Item id="__none__">{t('form.deviceNone')}</Select.Item>
            {printerAgentDevices.map((device: Device) => (
              <Select.Item key={device.id} id={device.id}>
                {device.name}
              </Select.Item>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
        <Button type="button" color="secondary" onClick={onClose}>
          {tCommon('cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid || isPending}
        >
          {isPending ? '...' : tCommon('save')}
        </Button>
      </div>
    </DialogModal>
  );
}
