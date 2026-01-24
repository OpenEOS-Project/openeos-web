import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DevicesList } from './components/devices-list';
import { DeviceRegistrationInfo } from './components/device-registration-info';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('navigation');

  return {
    title: t('devices'),
  };
}

export default async function DevicesPage() {
  const t = await getTranslations('devices');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-semibold text-primary">{t('title')}</h1>
          <p className="mt-1 text-md text-tertiary">{t('description')}</p>
        </div>
      </div>

      {/* Registration Info with QR Code */}
      <DeviceRegistrationInfo />

      {/* Devices List */}
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <DevicesList />
      </div>
    </div>
  );
}
