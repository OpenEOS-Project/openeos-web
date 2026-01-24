import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { WorkflowsContainer } from './components/workflows-container';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('workflows');

  return {
    title: t('title'),
  };
}

export default async function WorkflowsPage() {
  return <WorkflowsContainer />;
}
