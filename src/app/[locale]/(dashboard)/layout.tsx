import { AppShell } from '@/components/app-shell/app-shell';
import { AuthGuard } from '@/components/providers/auth-guard';
import { TourHost } from '@/components/onboarding/tour-host';

import '@/styles/landing.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <AppShell>
        {/* Innerhalb von AppShell, nicht daneben: dort sitzt die Klasse
            .landing, an der saemtliche Regeln des Designsystems haengen.
            Ausserhalb blieb die Tour zwar im DOM, aber ungestylt —
            position:static statt fixed, Sprechblase ueber die volle
            Breite, kein Schleier. Wo im Baum sie steht, ist sonst egal:
            sie liegt fest ueber der Seite. */}
        <TourHost />
        {children}
      </AppShell>
    </AuthGuard>
  );
}
