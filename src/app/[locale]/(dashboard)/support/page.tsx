import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SupportChat } from './components/support-chat';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('support');

  return {
    title: t('title'),
  };
}

export default function SupportPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SupportChat />
    </div>
  );
}
