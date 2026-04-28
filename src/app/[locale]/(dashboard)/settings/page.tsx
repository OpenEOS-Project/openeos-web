import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SettingsContainer } from './components/settings-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');

  return {
    title: t('title'),
  };
}

export default async function SettingsPage() {
  const t = await getTranslations('settings');

  return (
    <div>
      <div className="app-page-head">
        <div>
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">Verwalten Sie Ihre persönlichen und Organisationseinstellungen</p>
        </div>
      </div>

      <SettingsContainer />
    </div>
  );
}
