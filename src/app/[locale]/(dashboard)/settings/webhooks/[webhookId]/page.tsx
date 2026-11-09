import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { WebhookDeliveriesView } from './webhook-deliveries-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings.organizationWebhooks.deliveries');
  return { title: t('pageTitle') };
}

export default function WebhookDeliveriesPage() {
  return <WebhookDeliveriesView />;
}
