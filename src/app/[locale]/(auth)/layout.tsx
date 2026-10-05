import '@/styles/auth-classic.css';

import { getTranslations } from 'next-intl/server';

import { Logo } from '@/components/foundations/logo/logo';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Rahmen fuer Passwort vergessen/zuruecksetzen, Anmeldelink, E-Mail-
 * Bestaetigung und 2FA.
 *
 * Die Seiten selbst sind noch mit den Untitled-Bausteinen gebaut. Statt
 * sie alle neu zu schreiben, legt auth-classic.css deren Farbtokens auf
 * die OpenEOS-Palette — Papierhintergrund, Karte und Primaerknopf sehen
 * damit aus wie bei Anmeldung und Registrierung.
 */
export default async function AuthLayout({ children }: AuthLayoutProps) {
  const t = await getTranslations('auth.layout');

  return (
    <div className="auth-classic relative flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Top Bar */}
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-[440px]">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Logo height={36} width={180} />
        </div>

        {/* Content Card */}
        <div className="auth-classic__card p-6 sm:p-8">{children}</div>

        {/* Footer */}
        <p className="auth-classic__foot mt-8 text-center">
          &copy; {new Date().getFullYear()} OpenEOS. {t('rightsReserved')}
        </p>
      </div>
    </div>
  );
}
