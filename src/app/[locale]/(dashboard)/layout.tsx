'use client';

import { DashboardSidebar } from '@/components/app-navigation/dashboard-sidebar';
import { AuthGuard } from '@/components/providers/auth-guard';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useSidebarStore } from '@/stores/sidebar-store';
import { cx } from '@/utils/cx';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isFullscreen } = useSidebarStore();

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-secondary">
        <DashboardSidebar />

        <main className="flex flex-1 flex-col">
          {/* Top bar with theme toggle - hidden in fullscreen mode */}
          <header
            className={cx(
              'sticky top-0 z-40 flex h-16 items-center justify-end border-b border-secondary bg-primary px-4 lg:px-6',
              isFullscreen && 'hidden'
            )}
          >
            <ThemeToggle />
          </header>

          {/* Main content area */}
          <div className={cx('flex-1', !isFullscreen && 'p-4 lg:p-6')}>{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
