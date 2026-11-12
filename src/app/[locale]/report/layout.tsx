import type { Metadata } from 'next';

import '@/styles/landing.css';
import '@/styles/shifts-public.css';

/* Formular „Inhalt melden“ (Art. 16 DSA): öffentlich, nicht in Suchmaschinen. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <div className="landing shifts-public">{children}</div>;
}
