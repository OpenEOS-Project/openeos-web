import '@/styles/landing.css';
import '@/styles/shifts-public.css';

/* Schriften kommen aus dem Locale-Layout (`openEosFonts` aus
   @openeos/ui, lokal eingebunden) — hier keine eigene Einbindung. */
export default function ShiftPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="landing shifts-public">{children}</div>;
}
