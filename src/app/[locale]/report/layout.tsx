import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import '@/styles/landing.css';
import '@/styles/shifts-public.css';

/* Formular „Inhalt melden“ (Art. 16 DSA): öffentlich, nicht in Suchmaschinen. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pageTitles');
  return {
    title: t('contentReport'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <div className="landing shifts-public">{children}</div>;
}
