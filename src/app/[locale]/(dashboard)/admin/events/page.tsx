import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminEventsContainer } from './components/admin-events-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.events');
  return { title: t('title') };
}

export default async function AdminEventsPage() {
  const t = await getTranslations('admin.events');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-page-head">
        <div>
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('description')}</p>
        </div>
      </div>

      <AdminEventsContainer />
    </div>
  );
}
