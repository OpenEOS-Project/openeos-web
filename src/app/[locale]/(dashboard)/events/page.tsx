import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { EventsContainer } from './components/events-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('navigation');

  return {
    title: t('events'),
  };
}

export default async function EventsPage() {
  const t = await getTranslations('events');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold text-primary">{t('title')}</h1>
        <p className="mt-1 text-md text-tertiary">{t('subtitle')}</p>
      </div>

      <EventsContainer />
    </div>
  );
}
