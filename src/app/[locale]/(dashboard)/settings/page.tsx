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
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold text-primary">{t('title')}</h1>
        <p className="mt-1 text-md text-tertiary">
          Verwalten Sie Ihre persönlichen und Organisationseinstellungen
        </p>
      </div>

      <SettingsContainer />
    </div>
  );
}
