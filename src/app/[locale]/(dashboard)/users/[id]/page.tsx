import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { UserDetail } from './user-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('users');

  return {
    title: t('detail.title'),
  };
}

export default function UserDetailPage() {
  return <UserDetail />;
}
