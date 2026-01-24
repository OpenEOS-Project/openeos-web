import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { EmptyState } from '@/components/ui/empty-state/empty-state';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('navigation');

  return {
    title: t('printers'),
  };
}

export default async function PrintersPage() {
  const t = await getTranslations('navigation');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold text-primary">{t('printers')}</h1>
        <p className="mt-1 text-md text-tertiary">Verwalten Sie Ihre Drucker und Bondrucker</p>
      </div>

      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="printer"
          title="Noch keine Drucker"
          description="Hier werden Ihre Drucker angezeigt. Diese Seite wird bald verfügbar sein."
        />
      </div>
    </div>
  );
}
