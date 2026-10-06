import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ModuleGuard } from '@/components/shared/module-guard';

import { TablesContainer } from './components/tables-container';
import './tables.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pageTitles');
  return { title: t('tables') };
}

/**
 * Tische der Organisation: Bereiche (Zelt, Saal, Biergarten), ihre Karte
 * und die Tische darin. Welche Veranstaltung welche Bereiche nutzt, steht
 * in der Veranstaltung (Tischmodus), der Standardbereich einer Kasse im
 * Gerät. Schreiben dürfen Admins und Mitglieder mit Veranstaltungsrecht —
 * dasselbe Recht wie die API.
 */
export default async function TablesPage() {
  const t = await getTranslations('tables');

  return (
    <ModuleGuard requiredPermission="events">
      <div className="tables-page">
        <div className="app-page-head">
          <div className="app-page-head__copy">
            <h1 className="app-page-head__title">{t('title')}</h1>
            <p className="app-page-head__sub">{t('subtitle')}</p>
          </div>
        </div>

        <TablesContainer />
      </div>
    </ModuleGuard>
  );
}
