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
        <div>
          <h1 className="section-title">{t('title')}</h1>
          <p style={{ marginTop: 4, fontSize: 14, color: 'var(--ink-faint)' }}>{t('subtitle')}</p>
        </div>
      </div>

      <OrganizationsContainer />
    </div>
  );
}
