'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Select } from '@/components/ui/select/select';
import { Label } from '@/components/ui/input/label';
import { adminApi } from '@/lib/api-client';
import { useCreateRentalHardware, useUpdateRentalHardware } from '@/hooks/use-rentals';
import type { RentalHardware, CreateRentalHardwareData, UpdateRentalHardwareData } from '@/types/rental';
import type { Device } from '@/types/device';

interface HardwareFormModalProps {
  hardware?: RentalHardware | null;
  onClose: () => void;
}

export function HardwareFormModal({ hardware, onClose }: HardwareFormModalProps) {
  const t = useTranslations('admin.rental.hardware');
  const tCommon = useTranslations('common');
  const isEdit = !!hardware;

  const config = hardware?.hardwareConfig ?? {};

  // Basic fields
  const [type, setType] = useState<'printer' | 'display'>(
    (hardware?.type as 'printer' | 'display') ?? 'printer'
  );
  const [name, setName] = useState(hardware?.name ?? '');
  const [serialNumber, setSerialNumber] = useState(hardware?.serialNumber ?? '');
  const [model, setModel] = useState(hardware?.model ?? '');
  const [description, setDescription] = useState(hardware?.description ?? '');
  const [dailyRate, setDailyRate] = useState(String(hardware?.dailyRate ?? ''));
  const [notes, setNotes] = useState(hardware?.notes ?? '');
  const [deviceId, setDeviceId] = useState<string>(hardware?.deviceId ?? '');

  // Printer-specific config
  const [printerType, setPrinterType] = useState<string>(
    (config.printerType as string) ?? 'receipt'
  );
  const [connectionType, setConnectionType] = useState<string>(
    (config.connectionType as string) ?? 'usb'
  );
  const [paperWidth, setPaperWidth] = useState<number>(
    (config.paperWidth as number) ?? 80
  );
  const [ipAddress, setIpAddress] = useState((config.ipAddress as string) ?? '');
  const [port, setPort] = useState(String((config.port as number) ?? 9100));
  const [usbVendorId, setUsbVendorId] = useState((config.usbVendorId as string) ?? '');
  const [usbProductId, setUsbProductId] = useState((config.usbProductId as string) ?? '');

  const createMutation = useCreateRentalHardware();
  const updateMutation = useUpdateRentalHardware();
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Fetch unassigned printer_agent devices for dropdown
  const { data: devicesData } = useQuery({
    queryKey: ['admin', 'devices', 'printer_agent', 'unassigned'],
    queryFn: () => adminApi.listDevices({ type: 'printer_agent', unassigned: 'true' }),
  });

  // Include already-linked device if editing
  const unassignedDevices = (devicesData?.data ?? []) as Device[];
  const currentDevice = hardware?.device;
  const deviceOptions: { id: string; name: string }[] = [
    ...unassignedDevices.map((d) => ({ id: d.id, name: d.name })),
  ];
  if (currentDevice && !deviceOptions.some((d) => d.id === currentDevice.id)) {
    deviceOptions.unshift({ id: currentDevice.id, name: currentDevice.name });
  }

  function buildHardwareConfig(): Record<string, unknown> {
    if (type !== 'printer') return {};

    const cfg: Record<string, unknown> = {
      printerType,
      connectionType,
      paperWidth,
    };

    if (connectionType === 'network') {
      cfg.ipAddress = ipAddress;
      cfg.port = parseInt(port, 10) || 9100;
    } else if (connectionType === 'usb') {
      cfg.usbVendorId = usbVendorId;
      cfg.usbProductId = usbProductId;
    }

    return cfg;
  }

  function handleSubmit() {
    const rate = parseFloat(dailyRate) || 0;
    const hardwareConfig = buildHardwareConfig();

    if (isEdit && hardware) {
      const data: UpdateRentalHardwareData = {
        type,
        name,
        serialNumber,
        model: model || undefined,
        description: description || undefined,
        dailyRate: rate,
        hardwareConfig,
        deviceId: deviceId || null,
        notes: notes || undefined,
      };
      updateMutation.mutate(
        { id: hardware.id, data },
        { onSuccess: () => onClose() }
      );
    } else {
      const data: CreateRentalHardwareData = {
        type,
        name,
        serialNumber,
        model: model || undefined,
        description: description || undefined,
        dailyRate: rate,
        hardwareConfig,
        deviceId: deviceId || null,
        notes: notes || undefined,
      };
      createMutation.mutate(data, { onSuccess: () => onClose() });
    }
  }

  const isValid = name.trim().length > 0 && serialNumber.trim().length > 0 && parseFloat(dailyRate) > 0;

  return (
    <DialogModal
      isOpen
      onClose={onClose}
      title={isEdit ? t('edit') : t('add')}
      size="lg"
    >
      <div className="max-h-[70vh] overflow-y-auto space-y-4 px-6 py-4">
        {/* Type */}
        <div className="space-y-1.5">
          <Label>{t('form.type')}</Label>
          <Select
            selectedKey={type}
            onSelectionChange={(key) => setType(key as 'printer' | 'display')}
            aria-label={t('form.type')}
          >
            <Select.Item id="printer">{t('types.printer')}</Select.Item>
            <Select.Item id="display">{t('types.display')}</Select.Item>
          </Select>
        </div>

        {/* Name + Serial */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('form.name')}
            placeholder={t('form.namePlaceholder')}
            value={name}
            onChange={(val) => setName(val)}
            isRequired
          />
          <Input
            label={t('form.serial')}
            placeholder={t('form.serialPlaceholder')}
            value={serialNumber}
            onChange={(val) => setSerialNumber(val)}
            isRequired
          />
        </div>

        {/* Model */}
        <Input
          label={t('form.model')}
          placeholder={t('form.modelPlaceholder')}
          value={model}
          onChange={(val) => setModel(val)}
        />

        {/* Description */}
        <Input
          label={t('form.description')}
          placeholder={t('form.descriptionPlaceholder')}
          value={description}
          onChange={(val) => setDescription(val)}
        />

        {/* Daily Rate */}
        <Input
          label={t('form.dailyRate')}
          placeholder="0.00"
          value={dailyRate}
          onChange={(val) => setDailyRate(val)}
          isRequired
        />

        {/* Device (Printer Agent) */}
        <div className="space-y-1.5">
          <Label>{t('form.device')}</Label>
          <Select
            selectedKey={deviceId || '__none__'}
            onSelectionChange={(key) => setDeviceId(key === '__none__' ? '' : String(key))}
            aria-label={t('form.device')}
          >
            <Select.Item id="__none__">{t('form.deviceNone')}</Select.Item>
            {deviceOptions.map((device) => (
              <Select.Item key={device.id} id={device.id}>
                {device.name}
              </Select.Item>
            ))}
          </Select>
        </div>

        {/* Printer-specific config */}
        {type === 'printer' && (
          <div className="space-y-4 rounded-lg border border-secondary p-4">
            <p className="text-sm font-medium text-primary">{t('form.printerConfig')}</p>

            <div className="grid grid-cols-3 gap-4">
              {/* Printer Type */}
              <div className="space-y-1.5">
                <Label>{t('form.printerType')}</Label>
                <Select
                  selectedKey={printerType}
                  onSelectionChange={(key) => setPrinterType(String(key))}
                  aria-label={t('form.printerType')}
                >
                  <Select.Item id="receipt">{t('form.printerTypes.receipt')}</Select.Item>
                  <Select.Item id="kitchen">{t('form.printerTypes.kitchen')}</Select.Item>
                  <Select.Item id="label">{t('form.printerTypes.label')}</Select.Item>
                </Select>
              </div>

              {/* Connection Type */}
              <div className="space-y-1.5">
                <Label>{t('form.connectionType')}</Label>
                <Select
                  selectedKey={connectionType}
                  onSelectionChange={(key) => setConnectionType(String(key))}
                  aria-label={t('form.connectionType')}
                >
                  <Select.Item id="network">{t('form.connectionTypes.network')}</Select.Item>
                  <Select.Item id="usb">{t('form.connectionTypes.usb')}</Select.Item>
                  <Select.Item id="bluetooth">{t('form.connectionTypes.bluetooth')}</Select.Item>
                </Select>
              </div>

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
            </div>

            {/* Connection-specific fields */}
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
          </div>
        )}

        {/* Notes */}
        <Input
          label={t('form.notes')}
          placeholder={t('form.notesPlaceholder')}
          value={notes}
          onChange={(val) => setNotes(val)}
        />
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
