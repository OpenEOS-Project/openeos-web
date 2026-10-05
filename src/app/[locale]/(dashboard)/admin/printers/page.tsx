import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminPrintersContainer } from './components/admin-printers-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.printers');
  return { title: t('metaTitle') };
}

export default async function AdminPrintersPage() {
  const t = await getTranslations('admin.printers');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-page-head">
        <div>
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('description')}</p>
        </div>
      </div>
      <AdminPrintersContainer />
    </div>
  );
}
