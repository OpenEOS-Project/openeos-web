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
    <div className="space-y-4 sm:space-y-6">
      <div className="hidden md:block">
        <h1 className="text-display-sm font-semibold text-primary">{t('title')}</h1>
        <p className="mt-1 text-md text-tertiary">{t('description')}</p>
      </div>

      <RentalHardwareContainer />
    </div>
  );
}
