import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminTseContainer } from './components/admin-tse-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.tse');
  return { title: t('metaTitle') };
}

export default async function AdminTsePage() {
  const t = await getTranslations('admin.tse');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('description')}</p>
        </div>
      </div>
      <AdminTseContainer />
    </div>
  );
}
