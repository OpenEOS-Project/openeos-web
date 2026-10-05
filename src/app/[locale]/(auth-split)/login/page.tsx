import { pageTitle } from '@/lib/page-title';

import { LoginComic } from './login-comic';
import { LoginForm } from './login-form';

// Die Ueberschrift ist ein Satz mit Punkt ("Willkommen zurueck.") — im
// Browser-Tab steht ein schlichter Titel.
export const generateMetadata = pageTitle('login');

export default async function LoginPage() {
  return (
    <div className="auth__split">
      <div className="auth__left">
        <LoginComic />
      </div>
      <div className="auth__right">
        <LoginForm />
      </div>
    </div>
  );
}
