import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PrintersContainer } from './components/printers-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('navigation');
  return { title: t('printers') };
}

export default async function PrintersPage() {
  const t = await getTranslations('navigation');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('printers')}</h1>
        </div>
      </div>
      <PrintersContainer />
    </div>
  );
}
