'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi, sumupApi } from '@/lib/api-client';
import { useEvents } from '@/hooks/use-events';
import { useProductionStations } from '@/hooks/use-production-stations';
import type { Device, DeviceClass, DisplayMode, ServiceMode } from '@/types/device';

interface DeviceSettingsProps {
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

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</label>
      {children}
    </div>
  );
}

export function DeviceSettings({ device, organizationId }: DeviceSettingsProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();

  const sumupConfigured = !!currentOrganization?.organization?.settings?.sumup?.merchantCode;

  const [name, setName] = useState(device.name);
  const [type, setType] = useState<DeviceClass>(device.type);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(device.settings?.displayMode || 'kitchen');
  const [serviceMode, setServiceMode] = useState<ServiceMode>(device.settings?.serviceMode || 'table');
  const [requirePin, setRequirePin] = useState(device.settings?.requirePin ?? false);
  const [sumupReaderId, setSumupReaderId] = useState((device.settings?.sumupReaderId as string) || '');
  const [stationId, setStationId] = useState((device.settings?.stationId as string) || '');
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

  const { data: events } = useEvents(organizationId);
  const availableEvents = (events || []).filter((e) => e.status === 'active' || e.status === 'test');

  useEffect(() => {
    if (displayMode === 'station' && availableEvents.length > 0 && !stationEventId) {
      setStationEventId(availableEvents[0].id);
    }
  }, [displayMode, availableEvents, stationEventId]);

  const { data: productionStations } = useProductionStations(displayMode === 'station' ? stationEventId : '');

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
  const displayModeOptions: DisplayMode[] = ['kitchen', 'delivery', 'menu', 'pickup', 'sales', 'customer', 'station'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionCard
        title={t('devices.detail.settings.basic.title')}
        description={t('devices.detail.settings.basic.description')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormRow label={t('devices.edit.name')}>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('devices.edit.namePlaceholder')}
            />
          </FormRow>

          <FormRow label={t('devices.edit.type')}>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as DeviceClass)}>
              {typeOptions.map((opt) => (
                <option key={opt} value={opt}>{t(`devices.class.${opt}`)}</option>
              ))}
            </select>
          </FormRow>

          {type === 'display' && (
            <FormRow label={t('devices.displayMode.label')}>
              <select className="select" value={displayMode} onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}>
                {displayModeOptions.map((opt) => (
                  <option key={opt} value={opt}>{t(`devices.displayMode.${opt}`)}</option>
                ))}
              </select>
            </FormRow>
          )}

          {type === 'display' && displayMode === 'station' && (
            <>
              <FormRow label={t('devices.detail.settings.station.event')}>
                <select
                  className="select"
                  value={stationEventId}
                  onChange={(e) => { setStationEventId(e.target.value); setStationId(''); }}
                >
                  {availableEvents.map((event) => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
              </FormRow>

              {stationEventId && (
                <FormRow label={t('devices.detail.settings.station.station')}>
                  <select className="select" value={stationId} onChange={(e) => setStationId(e.target.value)}>
                    <option value="">{t('devices.detail.settings.station.none')}</option>
                    {(productionStations || []).map((station) => (
                      <option key={station.id} value={station.id}>{station.name}</option>
                    ))}
                  </select>
                </FormRow>
              )}
            </>
          )}

          {type === 'pos' && sumupConfigured && (
            <FormRow label={t('devices.edit.sumupReader')}>
              <select className="select" value={sumupReaderId} onChange={(e) => setSumupReaderId(e.target.value)}>
                <option value="">{t('devices.edit.sumupReaderNone')}</option>
                {(readersQuery.data || []).map((reader) => (
                  <option key={reader.id} value={reader.id}>{reader.name}</option>
                ))}
              </select>
            </FormRow>
          )}

          {type === 'pos' && !sumupConfigured && (
            <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
              {t('devices.edit.sumupNotConfigured')}
            </p>
          )}
        </div>
      </SectionCard>

      {type === 'pos' && (
        <SectionCard
          title={t('devices.detail.settings.serviceMode.title')}
          description={t('devices.detail.settings.serviceMode.description')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['table', 'counter'] as ServiceMode[]).map((mode) => (
              <label key={mode} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="serviceMode"
                  value={mode}
                  checked={serviceMode === mode}
                  onChange={() => setServiceMode(mode)}
                  style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--green-ink)' }}
                />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                    {t(`devices.detail.settings.serviceMode.${mode}`)}
                  </p>
                  <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: '2px 0 0' }}>
                    {t(`devices.detail.settings.serviceMode.${mode}Description`)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </SectionCard>
      )}

      {type === 'pos' && (
        <SectionCard
          title={t('devices.detail.settings.auth.title')}
          description={t('devices.detail.settings.auth.description')}
        >
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, cursor: 'pointer' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                {t('devices.detail.settings.auth.requirePin')}
              </p>
              <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: '2px 0 0' }}>
                {t('devices.detail.settings.auth.requirePinDescription')}
              </p>
            </div>
            <input
              type="checkbox"
              checked={requirePin}
              onChange={(e) => setRequirePin(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--green-ink)', flexShrink: 0 }}
            />
          </label>
          <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginTop: 12 }}>
            {t('devices.detail.settings.auth.pinManagedPerMember')}
          </p>
        </SectionCard>
      )}

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
