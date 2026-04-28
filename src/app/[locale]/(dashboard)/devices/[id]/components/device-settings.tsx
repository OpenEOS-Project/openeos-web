'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { Select } from '@/components/ui/select/select';
import { RadioGroup, RadioButton } from '@/components/ui/radio-buttons/radio-buttons';
import { Toggle } from '@/components/ui/toggle/toggle';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi, sumupApi } from '@/lib/api-client';
import { useEvents } from '@/hooks/use-events';
import { useProductionStations } from '@/hooks/use-production-stations';
import type { Device, DeviceClass, DisplayMode, ServiceMode } from '@/types/device';

interface DeviceSettingsProps {
  device: Device;
  organizationId: string;
}

export function DeviceSettings({ device, organizationId }: DeviceSettingsProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();

  const sumupConfigured = !!currentOrganization?.organization?.settings?.sumup?.merchantCode;

  const [name, setName] = useState(device.name);
  const [type, setType] = useState<DeviceClass>(device.type);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    device.settings?.displayMode || 'kitchen'
  );
  const [serviceMode, setServiceMode] = useState<ServiceMode>(
    device.settings?.serviceMode || 'table'
  );
  const [requirePin, setRequirePin] = useState(device.settings?.requirePin ?? false);
  const [sumupReaderId, setSumupReaderId] = useState(
    (device.settings?.sumupReaderId as string) || ''
  );
  const [stationId, setStationId] = useState(
    (device.settings?.stationId as string) || ''
  );
  const [stationEventId, setStationEventId] = useState('');

  useEffect(() => {
    setName(device.name);
    setType(device.type);
    setDisplayMode(device.settings?.displayMode || 'kitchen');
    setServiceMode(device.settings?.serviceMode || 'table');
    setRequirePin(device.settings?.requirePin ?? false);
    setSumupReaderId((device.settings?.sumupReaderId as string) || '');
    setStationId((device.settings?.stationId as string) || '');
  }, [device]);

  // Load events for station display mode
  const { data: events } = useEvents(organizationId);
  const availableEvents = (events || []).filter(
    (e) => e.status === 'active' || e.status === 'test'
  );

  // Auto-select first event for station mode
  useEffect(() => {
    if (displayMode === 'station' && availableEvents.length > 0 && !stationEventId) {
      setStationEventId(availableEvents[0].id);
    }
  }, [displayMode, availableEvents, stationEventId]);

  // Load production stations for the selected event
  const { data: productionStations } = useProductionStations(
    displayMode === 'station' ? stationEventId : ''
  );

  // Load SumUp readers for POS devices
  const readersQuery = useQuery({
    queryKey: ['sumup-readers', organizationId],
    queryFn: async () => {
      const response = await sumupApi.listReaders(organizationId);
      return response.data || [];
    },
    enabled: !!organizationId && type === 'pos' && sumupConfigured,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      devicesApi.update(organizationId, device.id, {
        name,
        type,
        settings: {
          ...device.settings,
          displayMode: type === 'display' ? displayMode : device.settings?.displayMode,
          serviceMode: type === 'pos' ? serviceMode : device.settings?.serviceMode,
          printerMode: device.settings?.printerMode,
          requirePin: type === 'pos' ? requirePin : device.settings?.requirePin,
          sumupReaderId: type === 'pos' ? (sumupReaderId || undefined) : device.settings?.sumupReaderId,
          stationId: type === 'display' && displayMode === 'station' ? (stationId || undefined) : undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', organizationId, device.id] });
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
    },
  });

  const typeOptions: DeviceClass[] = ['pos', 'display', 'admin'];
  const displayModeOptions: DisplayMode[] = [
    'kitchen',
    'delivery',
    'menu',
    'pickup',
    'sales',
    'customer',
    'station',
  ];

  return (
    <div className="space-y-6">
      {/* Basic Settings */}
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <h3 className="text-lg font-semibold text-primary">
          {t('devices.detail.settings.basic.title')}
        </h3>
        <p className="mt-1 text-sm text-tertiary">
          {t('devices.detail.settings.basic.description')}
        </p>

        <div className="mt-6 space-y-4">
          <Input
            label={t('devices.edit.name')}
            value={name}
            onChange={setName}
            placeholder={t('devices.edit.namePlaceholder')}
          />

          <div>
            <Label>{t('devices.edit.type')}</Label>
            <Select
              selectedKey={type}
              onSelectionChange={(key) => setType(key as DeviceClass)}
              aria-label={t('devices.edit.type')}
            >
              {typeOptions.map((opt) => (
                <Select.Item key={opt} id={opt} textValue={t(`devices.class.${opt}`)}>
                  {t(`devices.class.${opt}`)}
                </Select.Item>
              ))}
            </Select>
          </div>

          {type === 'display' && (
            <div>
              <Label>{t('devices.displayMode.label')}</Label>
              <Select
                selectedKey={displayMode}
                onSelectionChange={(key) => setDisplayMode(key as DisplayMode)}
                aria-label={t('devices.displayMode.label')}
              >
                {displayModeOptions.map((opt) => (
                  <Select.Item key={opt} id={opt} textValue={t(`devices.displayMode.${opt}`)}>
                    {t(`devices.displayMode.${opt}`)}
                  </Select.Item>
                ))}
              </Select>
            </div>
          )}

          {type === 'display' && displayMode === 'station' && (
            <>
              <div>
                <Label>{t('devices.detail.settings.station.event')}</Label>
                <Select
                  selectedKey={stationEventId}
                  onSelectionChange={(key) => {
                    setStationEventId(key as string);
                    setStationId('');
                  }}
                  aria-label={t('devices.detail.settings.station.event')}
                >
                  {availableEvents.map((event) => (
                    <Select.Item key={event.id} id={event.id} textValue={event.name}>
                      {event.name}
                    </Select.Item>
                  ))}
                </Select>
              </div>
              {stationEventId && (
                <div>
                  <Label>{t('devices.detail.settings.station.station')}</Label>
                  <Select
                    selectedKey={stationId}
                    onSelectionChange={(key) => setStationId(key as string)}
                    aria-label={t('devices.detail.settings.station.station')}
                  >
                    <Select.Item key="" id="" textValue={t('devices.detail.settings.station.none')}>
                      {t('devices.detail.settings.station.none')}
                    </Select.Item>
                    {(productionStations || []).map((station) => (
                      <Select.Item key={station.id} id={station.id} textValue={station.name}>
                        {station.name}
                      </Select.Item>
                    ))}
                  </Select>
                </div>
              )}
            </>
          )}

          {/* SumUp Reader (POS only, when SumUp configured) */}
          {type === 'pos' && sumupConfigured && (
            <div>
              <Label>{t('devices.edit.sumupReader')}</Label>
              <Select
                selectedKey={sumupReaderId}
                onSelectionChange={(key) => setSumupReaderId(key as string)}
                aria-label={t('devices.edit.sumupReader')}
              >
                <Select.Item key="" id="" textValue={t('devices.edit.sumupReaderNone')}>
                  {t('devices.edit.sumupReaderNone')}
                </Select.Item>
                {(readersQuery.data || []).map((reader) => (
                  <Select.Item key={reader.id} id={reader.id} textValue={reader.name}>
                    {reader.name}
                  </Select.Item>
                ))}
              </Select>
            </div>
          )}

          {type === 'pos' && !sumupConfigured && (
            <p className="text-xs text-tertiary">{t('devices.edit.sumupNotConfigured')}</p>
          )}
        </div>
      </div>

      {/* Service Mode (POS only) */}
      {type === 'pos' && (
        <div className="rounded-xl border border-secondary bg-primary p-6">
          <h3 className="text-lg font-semibold text-primary">
            {t('devices.detail.settings.serviceMode.title')}
          </h3>
          <p className="mt-1 text-sm text-tertiary">
            {t('devices.detail.settings.serviceMode.description')}
          </p>

          <div className="mt-6">
            <RadioGroup
              value={serviceMode}
              onChange={(value) => setServiceMode(value as ServiceMode)}
            >
              <RadioButton
                value="table"
                label={t('devices.detail.settings.serviceMode.table')}
                hint={t('devices.detail.settings.serviceMode.tableDescription')}
              />
              <RadioButton
                value="counter"
                label={t('devices.detail.settings.serviceMode.counter')}
                hint={t('devices.detail.settings.serviceMode.counterDescription')}
              />
            </RadioGroup>
          </div>
        </div>
      )}

      {/* Authentication (POS only) */}
      {type === 'pos' && (
        <div className="rounded-xl border border-secondary bg-primary p-6">
          <h3 className="text-lg font-semibold text-primary">
            {t('devices.detail.settings.auth.title')}
          </h3>
          <p className="mt-1 text-sm text-tertiary">
            {t('devices.detail.settings.auth.description')}
          </p>

          <div className="mt-6">
            <Toggle
              isSelected={requirePin}
              onChange={setRequirePin}
              label={t('devices.detail.settings.auth.requirePin')}
              hint={t('devices.detail.settings.auth.requirePinDescription')}
            />
            <p className="mt-3 text-xs text-tertiary">
              {t('devices.detail.settings.auth.pinManagedPerMember')}
            </p>
          </div>
        </div>
      )}

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
