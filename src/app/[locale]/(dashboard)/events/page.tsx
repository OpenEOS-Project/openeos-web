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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('subtitle')}</p>
        </div>
      </div>

      <EventsContainer />
    </div>
  );
}
