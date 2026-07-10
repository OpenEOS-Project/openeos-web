import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminSupportContainer } from './components/admin-support-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.support');

  return {
    title: t('title'),
  };
}

export default async function AdminSupportPage() {
  const t = await getTranslations('admin.support');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('subtitle')}</p>
        </div>
      </div>

      <AdminSupportContainer />
    </div>
  );
}
