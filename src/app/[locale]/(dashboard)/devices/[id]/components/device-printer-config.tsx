'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi, printersApi } from '@/lib/api-client';
import type { Device, PrinterMode } from '@/types/device';

interface DevicePrinterConfigProps {
  device: Device;
  organizationId: string;
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="app-card">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{title}</h2>
          {description && <p className="app-card__sub">{description}</p>}
        </div>
      </div>
      <div className="app-card__body">
        {children}
      </div>
    </div>
  );
}

export function DevicePrinterConfig({ device, organizationId }: DevicePrinterConfigProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [defaultPrinterId, setDefaultPrinterId] = useState((device.settings?.defaultPrinterId as string) || '');
  const [printerMode, setPrinterMode] = useState<PrinterMode>(device.settings?.printerMode || 'device');
  const [cashDrawerPrinterId, setCashDrawerPrinterId] = useState((device.settings?.cashDrawerPrinterId as string) || '');

  useEffect(() => {
    setDefaultPrinterId((device.settings?.defaultPrinterId as string) || '');
    setPrinterMode(device.settings?.printerMode || 'device');
    setCashDrawerPrinterId((device.settings?.cashDrawerPrinterId as string) || '');
  }, [device]);

  const { data: printersData } = useQuery({
    queryKey: ['printers', organizationId],
    queryFn: () => printersApi.list(organizationId),
    enabled: !!organizationId,
  });

  const printers = printersData?.data || [];

  const updateMutation = useMutation({
    mutationFn: () =>
      devicesApi.update(organizationId, device.id, {
        settings: {
          ...device.settings,
          defaultPrinterId: defaultPrinterId || undefined,
          printerMode,
          cashDrawerPrinterId: cashDrawerPrinterId || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', organizationId, device.id] });
    },
  });

  const routingModes: { value: PrinterMode; labelKey: string; descKey: string }[] = [
    { value: 'device', labelKey: 'devices.detail.printer.routing.device', descKey: 'devices.detail.printer.routing.deviceDescription' },
    { value: 'category', labelKey: 'devices.detail.printer.routing.category', descKey: 'devices.detail.printer.routing.categoryDescription' },
    { value: 'product', labelKey: 'devices.detail.printer.routing.product', descKey: 'devices.detail.printer.routing.productDescription' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionCard title={t('devices.detail.printer.defaultPrinter.title')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {t('devices.detail.printer.defaultPrinter.title')}
          </label>
          <select
            className="select"
            value={defaultPrinterId}
            onChange={(e) => setDefaultPrinterId(e.target.value)}
          >
            <option value="">{t('devices.detail.printer.defaultPrinter.noPrinter')}</option>
            {printers.map((printer) => (
              <option key={printer.id} value={printer.id}>
                {printer.isOnline ? '● ' : '○ '}{printer.name}
              </option>
            ))}
          </select>
        </div>
      </SectionCard>

      <SectionCard
        title={t('devices.detail.printer.routing.title')}
        description={t('devices.detail.printer.routing.description')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {routingModes.map((mode) => (
            <label key={mode.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="radio"
                name="printerMode"
                value={mode.value}
                checked={printerMode === mode.value}
                onChange={() => setPrinterMode(mode.value)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--green-ink)' }}
              />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{t(mode.labelKey)}</p>
                <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: '2px 0 0' }}>{t(mode.descKey)}</p>
              </div>
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={t('devices.detail.printer.cashDrawer.title')}
        description={t('devices.detail.printer.cashDrawer.description')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {t('devices.detail.printer.cashDrawer.selectPrinter')}
          </label>
          {printers.filter((p) => p.hasCashDrawer).length === 0 ? (
            <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', margin: 0 }}>
              {t('devices.detail.printer.cashDrawer.noPrintersAvailable')}
            </p>
          ) : (
            <select
              className="select"
              value={cashDrawerPrinterId}
              onChange={(e) => setCashDrawerPrinterId(e.target.value)}
            >
              <option value="">{t('devices.detail.printer.cashDrawer.noPrinter')}</option>
              {printers.filter((p) => p.hasCashDrawer).map((printer) => (
                <option key={printer.id} value={printer.id}>
                  {printer.isOnline ? '● ' : '○ '}{printer.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </SectionCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
        {updateMutation.isSuccess && (
          <span style={{ fontSize: 13, color: 'var(--green-ink)' }}>{t('devices.detail.saved')}</span>
        )}
        {updateMutation.isError && (
          <span style={{ fontSize: 13, color: '#d24545' }}>{t('devices.detail.saveFailed')}</span>
        )}
        <button
          className="btn btn--primary"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? '...' : t('common.save')}
        </button>
      </div>
    </div>
  );
}
