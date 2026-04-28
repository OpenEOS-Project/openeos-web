import type { Metadata } from 'next';
import { AdminEventsContainer } from './components/admin-events-container';

export const metadata: Metadata = {
  title: 'Events & Abrechnung',
};

export default function AdminEventsPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="hidden md:block">
        <h1 className="text-display-sm font-semibold text-primary">Events & Abrechnung</h1>
        <p className="mt-1 text-md text-tertiary">
          Alle Events aller Organisationen mit Bestellungen und Umsatz. Abrechnung verwalten.
        </p>
      </div>

      <AdminEventsContainer />
    </div>
  );
}
