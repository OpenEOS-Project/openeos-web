import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { ContentReportsContainer } from './components/content-reports-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.reports');
  return { title: t('title') };
}

export default async function AdminReportsPage() {
  const t = await getTranslations('admin.reports');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('description')}</p>
        </div>
      </div>

      <Suspense>
        <ContentReportsContainer />
      </Suspense>
    </div>
  );
}
