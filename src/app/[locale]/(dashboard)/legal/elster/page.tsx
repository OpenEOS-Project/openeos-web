import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminGuard } from '@/components/shared/admin-guard';

import { ElsterInfoView } from '../components/elster-info';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.elster');
  return { title: t('title') };
}

/** Nur für Admins: Steuernummer und Anschrift der Organisation. */
export default function LegalElsterPage() {
  return (
    <AdminGuard>
      <ElsterInfoView />
    </AdminGuard>
  );
}
