import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { MembersContainer } from './components/members-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('members');

  return {
    title: t('title'),
  };
}

export default async function MembersPage() {
  const t = await getTranslations('members');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">{t('subtitle')}</p>
        </div>
      </div>

      <MembersContainer />
    </div>
  );
}
