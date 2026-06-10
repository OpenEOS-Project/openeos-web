import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DiscountsContainer } from './components/discounts-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('discounts');

  return {
    title: t('title'),
  };
}

export default async function DiscountsPage() {
  const t = await getTranslations('discounts');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('subtitle')}</p>
        </div>
      </div>

      <DiscountsContainer />
    </div>
  );
}
