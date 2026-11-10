import type { Metadata } from 'next';

import '@/styles/landing.css';
import '@/styles/shifts-public.css';
import '@/styles/pos-receipt.css';

/* Öffentliche Beleg-Seite: nicht in Suchmaschinen, kein Verweis weiter. */
export const metadata: Metadata = {
  title: 'Beleg',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ReceiptLayout({ children }: { children: React.ReactNode }) {
  return <div className="landing shifts-public">{children}</div>;
}
