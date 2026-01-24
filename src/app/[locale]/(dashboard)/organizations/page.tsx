import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { OrganizationsContainer } from './components/organizations-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('navigation');

  return {
    title: t('organizations'),
  };
}

export default async function OrganizationsPage() {
  const t = await getTranslations('organizations');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold text-primary">{t('title')}</h1>
        <p className="mt-1 text-md text-tertiary">{t('subtitle')}</p>
      </div>

      <OrganizationsContainer />
    </div>
  );
}
