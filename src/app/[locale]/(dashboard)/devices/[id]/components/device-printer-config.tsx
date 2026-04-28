'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/buttons/button';
import { Label } from '@/components/ui/input/label';
import { Select } from '@/components/ui/select/select';
import { RadioGroup, RadioButton } from '@/components/ui/radio-buttons/radio-buttons';
import { devicesApi, printersApi } from '@/lib/api-client';
import type { Device, PrinterMode } from '@/types/device';

interface DevicePrinterConfigProps {
  device: Device;
  organizationId: string;
}

export function DevicePrinterConfig({ device, organizationId }: DevicePrinterConfigProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [defaultPrinterId, setDefaultPrinterId] = useState(
    (device.settings?.defaultPrinterId as string) || ''
  );
  const [printerMode, setPrinterMode] = useState<PrinterMode>(
    device.settings?.printerMode || 'device'
  );
  const [cashDrawerPrinterId, setCashDrawerPrinterId] = useState(
    (device.settings?.cashDrawerPrinterId as string) || ''
  );

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

  return (
    <div className="space-y-6">
      {/* Default Printer */}
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <h3 className="text-lg font-semibold text-primary">
          {t('devices.detail.printer.defaultPrinter.title')}
        </h3>

        <div className="mt-6">
          <Label>{t('devices.detail.printer.defaultPrinter.title')}</Label>
          <Select
            selectedKey={defaultPrinterId || ''}
            onSelectionChange={(key) => setDefaultPrinterId(key as string)}
            aria-label={t('devices.detail.printer.defaultPrinter.title')}
          >
            <Select.Item key="" id="" textValue={t('devices.detail.printer.defaultPrinter.noPrinter')}>
              {t('devices.detail.printer.defaultPrinter.noPrinter')}
            </Select.Item>
            {printers.map((printer) => (
              <Select.Item key={printer.id} id={printer.id} textValue={printer.name}>
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      printer.isOnline ? 'bg-success-primary' : 'bg-tertiary'
                    }`}
                  />
                  {printer.name}
                </span>
              </Select.Item>
            ))}
          </Select>
        </div>
      </div>

      {/* Print Routing */}
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <h3 className="text-lg font-semibold text-primary">
          {t('devices.detail.printer.routing.title')}
        </h3>
        <p className="mt-1 text-sm text-tertiary">
          {t('devices.detail.printer.routing.description')}
        </p>

        <div className="mt-6">
          <RadioGroup
            value={printerMode}
            onChange={(value) => setPrinterMode(value as PrinterMode)}
          >
            <RadioButton
              value="device"
              label={t('devices.detail.printer.routing.device')}
              hint={t('devices.detail.printer.routing.deviceDescription')}
            />
            <RadioButton
              value="category"
              label={t('devices.detail.printer.routing.category')}
              hint={t('devices.detail.printer.routing.categoryDescription')}
            />
            <RadioButton
              value="product"
              label={t('devices.detail.printer.routing.product')}
              hint={t('devices.detail.printer.routing.productDescription')}
            />
          </RadioGroup>
        </div>
      </div>

      {/* Cash Drawer */}
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <h3 className="text-lg font-semibold text-primary">
          {t('devices.detail.printer.cashDrawer.title')}
        </h3>
        <p className="mt-1 text-sm text-tertiary">
          {t('devices.detail.printer.cashDrawer.description')}
        </p>

        <div className="mt-6">
          <Label>{t('devices.detail.printer.cashDrawer.selectPrinter')}</Label>
          {printers.filter((p) => p.hasCashDrawer).length === 0 ? (
            <p className="mt-2 text-sm text-tertiary">
              {t('devices.detail.printer.cashDrawer.noPrintersAvailable')}
            </p>
          ) : (
            <Select
              selectedKey={cashDrawerPrinterId || ''}
              onSelectionChange={(key) => setCashDrawerPrinterId(key as string)}
              aria-label={t('devices.detail.printer.cashDrawer.selectPrinter')}
            >
              <Select.Item key="" id="" textValue={t('devices.detail.printer.cashDrawer.noPrinter')}>
                {t('devices.detail.printer.cashDrawer.noPrinter')}
              </Select.Item>
              {printers
                .filter((p) => p.hasCashDrawer)
                .map((printer) => (
                  <Select.Item key={printer.id} id={printer.id} textValue={printer.name}>
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          printer.isOnline ? 'bg-success-primary' : 'bg-tertiary'
                        }`}
                      />
                      {printer.name}
                    </span>
                  </Select.Item>
                ))}
            </Select>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => updateMutation.mutate()}
          isLoading={updateMutation.isPending}
        >
          {t('common.save')}
        </Button>
      </div>

      {updateMutation.isSuccess && (
        <p className="text-sm text-success-primary text-right">{t('devices.detail.saved')}</p>
      )}
      {updateMutation.isError && (
        <p className="text-sm text-error-primary text-right">{t('devices.detail.saveFailed')}</p>
      )}
    </div>
  );
}
