import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DashboardContainer } from './components/dashboard-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');

  return {
    title: t('title'),
  };
}

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="hidden md:block">
        <h1 className="text-display-sm font-semibold text-primary">{t('title')}</h1>
        <p className="mt-1 text-md text-tertiary">{t('subtitle')}</p>
      </div>

      {/* Dashboard Content */}
      <DashboardContainer />
    </div>
  );
}
