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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('description')}</p>
        </div>
      </div>

      {/* Registration Info with QR Code (for POS devices) */}
      <DeviceRegistrationInfo />

      {/* Devices List */}
      <div className="app-card app-card--flat">
        <DevicesList />
      </div>
    </div>
  );
}
