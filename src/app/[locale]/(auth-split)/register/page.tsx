import { pageTitle } from '@/lib/page-title';

import { RegisterWizard } from './register-wizard';

// Die Ueberschrift ist ein Satz mit Punkt ("Willkommen zurueck.") — im
// Browser-Tab steht ein schlichter Titel.
export const generateMetadata = pageTitle('register');

export default async function RegisterPage() {
  return (
    <div className="auth__container">
      <RegisterWizard />
    </div>
  );
}
