import type { Metadata } from 'next';
import { AdminPrintersContainer } from './components/admin-printers-container';

export const metadata: Metadata = {
  title: 'Drucker · Super-Admin',
};

export default function AdminPrintersPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-page-head">
        <div>
          <h1 className="app-page-head__title">Drucker</h1>
          <p className="app-page-head__sub">
            Übersicht aller Drucker und nicht zugewiesener Drucker-Agents über alle Organisationen hinweg.
          </p>
        </div>
      </div>
      <AdminPrintersContainer />
    </div>
  );
}
