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
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold text-primary">{t('printers')}</h1>
      </div>
      <PrintersContainer />
    </div>
  );
}
