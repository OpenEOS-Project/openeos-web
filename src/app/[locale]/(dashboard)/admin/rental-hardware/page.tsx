import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RentalHardwareContainer } from './components/rental-hardware-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.rental.hardware');

  return {
    title: t('title'),
  };
}

export default async function AdminRentalHardwarePage() {
  const t = await getTranslations('admin.rental.hardware');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-page-head">
        <div>
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('description')}</p>
        </div>
      </div>

      <RentalHardwareContainer />
    </div>
  );
}
