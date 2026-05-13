import { AppShell } from '@/components/app-shell/app-shell';
import { AuthGuard } from '@/components/providers/auth-guard';

import '@/styles/landing.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
