import '@/styles/landing.css';
import '@/styles/shifts-public.css';

import { pageTitle } from '@/lib/page-title';

/* Schriften kommen aus dem Locale-Layout (`openEosFonts` aus
   @openeos/ui, lokal eingebunden) — hier keine eigene Einbindung. */
/* Eigener Seitentitel statt nur „OpenEOS“ (WCAG 2.4.2). */
export const generateMetadata = pageTitle('helperSignup');

export default function ShiftPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="landing shifts-public">{children}</div>;
}
