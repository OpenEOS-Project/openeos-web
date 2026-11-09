import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ModuleGuard } from '@/components/shared/module-guard';

import { WaitersContainer } from './components/waiters-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('waiters');
  return { title: t('title') };
}

/**
 * Bedienungen: Kassenprofile ohne Konto und ohne E-Mail, mit PIN für den
 * schnellen Wechsel an gemeinsam genutzten Kassen (bedienungen-plan.md).
 */
export default async function WaitersPage() {
  const t = await getTranslations('waiters');

  return (
    <ModuleGuard requiredPermission="waiters">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="app-page-head">
          <div className="app-page-head__copy">
            <h1 className="app-page-head__title">{t('title')}</h1>
            <p className="app-page-head__sub">{t('subtitle')}</p>
          </div>
        </div>

        <WaitersContainer />
      </div>
    </ModuleGuard>
  );
}
