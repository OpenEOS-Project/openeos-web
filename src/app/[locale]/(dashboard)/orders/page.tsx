import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrdersList } from './components/orders-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('navigation');

  return {
    title: t('orders'),
  };
}

export default async function OrdersPage() {
  const t = await getTranslations('orders');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-semibold text-primary">{t('title')}</h1>
          <p className="mt-1 text-md text-tertiary">{t('description')}</p>
        </div>
      </div>

      {/* Orders List */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <OrdersList />
      </div>
    </div>
  );
}
