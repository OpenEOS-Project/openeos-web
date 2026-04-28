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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-page-head">
        <div>
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('description')}</p>
        </div>
      </div>

      <div className="app-card app-card--flat">
        <OrdersList />
      </div>
    </div>
  );
}
