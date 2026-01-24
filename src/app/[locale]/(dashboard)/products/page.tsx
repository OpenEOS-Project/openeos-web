import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ProductsContainer } from './components/products-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('products');

  return {
    title: t('title'),
  };
}

export default async function ProductsPage() {
  const t = await getTranslations('products');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold text-primary">{t('title')}</h1>
        <p className="mt-1 text-md text-tertiary">{t('subtitle')}</p>
      </div>

      <ProductsContainer />
    </div>
  );
}
