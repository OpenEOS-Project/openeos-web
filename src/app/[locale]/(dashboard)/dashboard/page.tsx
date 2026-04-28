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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            <span>OpenEOS</span>
            <span>Übersicht</span>
          </p>
          <h1 className="app-page-head__title">
            {t('title')}
          </h1>
          <p className="app-page-head__sub">{t('subtitle')}</p>
        </div>
      </div>

      {/* Dashboard content */}
      <DashboardContainer />
    </div>
  );
}
