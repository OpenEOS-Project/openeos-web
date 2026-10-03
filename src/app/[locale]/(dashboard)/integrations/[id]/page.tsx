import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getIntegration } from '@/config/integrations';

import { IntegrationConfigPage } from './integration-config-page';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('integrations');
  const integration = getIntegration(id);
  return { title: integration ? `${integration.name} · ${t('title')}` : t('title') };
}

/**
 * Konfigurationsseite einer Integration. Welche es gibt und was darauf
 * steht, bestimmt allein der Katalog; ohne Konfigurationskomponente
 * (angekündigte Integrationen) gibt es die Seite nicht.
 */
export default async function IntegrationPage({ params }: PageProps) {
  const { id } = await params;
  const integration = getIntegration(id);
  if (!integration || !integration.available || !integration.ConfigComponent) notFound();

  return <IntegrationConfigPage id={integration.id} />;
}
