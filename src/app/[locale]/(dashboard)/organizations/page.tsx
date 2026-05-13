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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('subtitle')}</p>
        </div>
      </div>

      <OrganizationsContainer />
    </div>
  );
}
