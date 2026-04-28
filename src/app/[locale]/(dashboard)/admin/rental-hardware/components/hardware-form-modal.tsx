'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
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

  const [type, setType] = useState<'printer' | 'display'>((hardware?.type as 'printer' | 'display') ?? 'printer');
  const [name, setName] = useState(hardware?.name ?? '');
  const [serialNumber, setSerialNumber] = useState(hardware?.serialNumber ?? '');
  const [model, setModel] = useState(hardware?.model ?? '');
  const [description, setDescription] = useState(hardware?.description ?? '');
  const [dailyRate, setDailyRate] = useState(String(hardware?.dailyRate ?? ''));
  const [notes, setNotes] = useState(hardware?.notes ?? '');
  const [deviceId, setDeviceId] = useState<string>(hardware?.deviceId ?? '');

  const [printerType, setPrinterType] = useState<string>((config.printerType as string) ?? 'receipt');
  const [connectionType, setConnectionType] = useState<string>((config.connectionType as string) ?? 'usb');
  const [paperWidth, setPaperWidth] = useState<number>((config.paperWidth as number) ?? 80);
  const [ipAddress, setIpAddress] = useState((config.ipAddress as string) ?? '');
  const [port, setPort] = useState(String((config.port as number) ?? 9100));
  const [usbVendorId, setUsbVendorId] = useState((config.usbVendorId as string) ?? '');
  const [usbProductId, setUsbProductId] = useState((config.usbProductId as string) ?? '');

  const createMutation = useCreateRentalHardware();
  const updateMutation = useUpdateRentalHardware();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const { data: devicesData } = useQuery({
    queryKey: ['admin', 'devices', 'printer_agent', 'unassigned'],
    queryFn: () => adminApi.listDevices({ type: 'printer_agent', unassigned: 'true' }),
  });

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
    const cfg: Record<string, unknown> = { printerType, connectionType, paperWidth };
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
        type, name, serialNumber,
        model: model || undefined,
        description: description || undefined,
        dailyRate: rate, hardwareConfig,
        deviceId: deviceId || null,
        notes: notes || undefined,
      };
      updateMutation.mutate({ id: hardware.id, data }, { onSuccess: onClose });
    } else {
      const data: CreateRentalHardwareData = {
        type, name, serialNumber,
        model: model || undefined,
        description: description || undefined,
        dailyRate: rate, hardwareConfig,
        deviceId: deviceId || null,
        notes: notes || undefined,
      };
      createMutation.mutate(data, { onSuccess: onClose });
    }
  }

  const isValid = name.trim().length > 0 && serialNumber.trim().length > 0 && parseFloat(dailyRate) > 0;

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{isEdit ? t('edit') : t('add')}</div>
          <button className="modal__close" onClick={onClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal__body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Type */}
            <div className="auth-field">
              <label className="auth-field__label">{t('form.type')}</label>
              <select className="select" value={type} onChange={(e) => setType(e.target.value as 'printer' | 'display')}>
                <option value="printer">{t('types.printer')}</option>
                <option value="display">{t('types.display')}</option>
              </select>
            </div>

            {/* Name + Serial */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="auth-field">
                <label className="auth-field__label">{t('form.name')} *</label>
                <input className="input" placeholder={t('form.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="auth-field">
                <label className="auth-field__label">{t('form.serial')} *</label>
                <input className="input" placeholder={t('form.serialPlaceholder')} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field__label">{t('form.model')}</label>
              <input className="input" placeholder={t('form.modelPlaceholder')} value={model} onChange={(e) => setModel(e.target.value)} />
            </div>

            <div className="auth-field">
              <label className="auth-field__label">{t('form.description')}</label>
              <input className="input" placeholder={t('form.descriptionPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="auth-field">
              <label className="auth-field__label">{t('form.dailyRate')} *</label>
              <input className="input" placeholder="0.00" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} />
            </div>

            <div className="auth-field">
              <label className="auth-field__label">{t('form.device')}</label>
              <select className="select" value={deviceId || '__none__'} onChange={(e) => setDeviceId(e.target.value === '__none__' ? '' : e.target.value)}>
                <option value="__none__">{t('form.deviceNone')}</option>
                {deviceOptions.map((device) => (
                  <option key={device.id} value={device.id}>{device.name}</option>
                ))}
              </select>
            </div>

            {/* Printer config */}
            {type === 'printer' && (
              <div style={{ border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t('form.printerConfig')}</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="auth-field">
                    <label className="auth-field__label">{t('form.printerType')}</label>
                    <select className="select" value={printerType} onChange={(e) => setPrinterType(e.target.value)}>
                      <option value="receipt">{t('form.printerTypes.receipt')}</option>
                      <option value="kitchen">{t('form.printerTypes.kitchen')}</option>
                      <option value="label">{t('form.printerTypes.label')}</option>
                    </select>
                  </div>
                  <div className="auth-field">
                    <label className="auth-field__label">{t('form.connectionType')}</label>
                    <select className="select" value={connectionType} onChange={(e) => setConnectionType(e.target.value)}>
                      <option value="network">{t('form.connectionTypes.network')}</option>
                      <option value="usb">{t('form.connectionTypes.usb')}</option>
                      <option value="bluetooth">{t('form.connectionTypes.bluetooth')}</option>
                    </select>
                  </div>
                  <div className="auth-field">
                    <label className="auth-field__label">{t('form.paperWidth')}</label>
                    <select className="select" value={String(paperWidth)} onChange={(e) => setPaperWidth(Number(e.target.value))}>
                      <option value="58">58mm</option>
                      <option value="80">80mm</option>
                    </select>
                  </div>
                </div>

                {connectionType === 'network' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="auth-field">
                      <label className="auth-field__label">{t('form.ipAddress')}</label>
                      <input className="input" placeholder="192.168.1.100" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
                    </div>
                    <div className="auth-field">
                      <label className="auth-field__label">{t('form.port')}</label>
                      <input className="input" placeholder="9100" value={port} onChange={(e) => setPort(e.target.value)} />
                    </div>
                  </div>
                )}

                {connectionType === 'usb' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="auth-field">
                      <label className="auth-field__label">{t('form.usbVendorId')}</label>
                      <input className="input" placeholder="0x04b8" value={usbVendorId} onChange={(e) => setUsbVendorId(e.target.value)} />
                    </div>
                    <div className="auth-field">
                      <label className="auth-field__label">{t('form.usbProductId')}</label>
                      <input className="input" placeholder="0x0202" value={usbProductId} onChange={(e) => setUsbProductId(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="auth-field">
              <label className="auth-field__label">{t('form.notes')}</label>
              <input className="input" placeholder={t('form.notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>{tCommon('cancel')}</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={!isValid || isPending}>
            {isPending ? '...' : tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
