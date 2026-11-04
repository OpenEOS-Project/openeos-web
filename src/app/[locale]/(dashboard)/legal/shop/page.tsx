import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ShopPrivacyTemplateView } from '../components/shop-privacy-template';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.shop');
  return { title: t('title') };
}

export default function LegalShopPage() {
  return <ShopPrivacyTemplateView />;
}
