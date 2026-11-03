import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminGuard } from '@/components/shared/admin-guard';

import { CashbookContainer } from './components/cashbook-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('cashbook');

  return {
    title: t('title'),
  };
}

export default async function CashbookPage() {
  const t = await getTranslations('cashbook');

  return (
    <AdminGuard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="app-page-head">
          <div className="app-page-head__copy">
            <h1 className="app-page-head__title">{t('title')}</h1>
            <p className="app-page-head__sub">{t('admin.subtitle')}</p>
          </div>
        </div>

        <CashbookContainer />
      </div>
    </AdminGuard>
  );
}
