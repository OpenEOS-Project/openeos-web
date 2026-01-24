import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BillingContainer } from './billing-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('billing');

  return {
    title: t('title'),
  };
}

export default async function BillingPage() {
  const t = await getTranslations('billing');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold text-primary">{t('title')}</h1>
        <p className="mt-1 text-md text-tertiary">{t('description')}</p>
      </div>

      <BillingContainer />
    </div>
  );
}
