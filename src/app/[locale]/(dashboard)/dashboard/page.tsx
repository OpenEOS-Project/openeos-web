import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DashboardContainer } from './components/dashboard-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');

  return {
    title: t('title'),
  };
}

/**
 * Der Seitenkopf steht bewusst im Container und nicht hier: Titel und
 * Bedienelemente (Zeitraum, Anordnen, Anpassen) gehören in dieselbe
 * Zeile, und die Bedienelemente brauchen Zustand — hier wäre nur der
 * Titel möglich und die Steuerung müsste darunter stehen.
 */
export default async function DashboardPage() {
  return <DashboardContainer />;
}
