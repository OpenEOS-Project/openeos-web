import '@/styles/landing.css';
import '@/styles/login-comic.css';

import { Logo } from '@/components/foundations/logo/logo';

export default function AuthSplitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      {/* Logo-Komponente statt eines festen Pfads: hier stand
          /logo_dark.png, das im Dark-Mode auf dunklem Grund fast
          verschwand — auf der Registrierungsseite besonders auffaellig,
          weil dort kein Bildpanel danebenliegt. */}
      <Logo className="auth-shell__logo" height={44} />
      <div className="landing">
        <main className="auth">{children}</main>
      </div>
    </div>
  );
}
