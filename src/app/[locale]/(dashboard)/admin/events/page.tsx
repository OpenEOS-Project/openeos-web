import type { Metadata } from 'next';
import { AdminEventsContainer } from './components/admin-events-container';

export const metadata: Metadata = {
  title: 'Events & Abrechnung',
};

export default function AdminEventsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-page-head">
        <div>
          <h1 className="app-page-head__title">Events & Abrechnung</h1>
          <p className="app-page-head__sub">
            Alle Events aller Organisationen mit Bestellungen und Umsatz. Abrechnung verwalten.
          </p>
        </div>
      </div>

      <AdminEventsContainer />
    </div>
  );
}
