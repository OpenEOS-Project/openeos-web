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
      <AppShell>{children}</AppShell>
      {/* Innerhalb des Guards, damit die Tour nur laeuft, wenn jemand
          angemeldet ist — ihre Ziele sind Teile der angemeldeten
          Oberflaeche. */}
      <TourHost />
    </AuthGuard>
  );
}
