'use client';

import { DashboardSidebar } from '@/components/app-navigation/dashboard-sidebar';
import { AuthGuard } from '@/components/providers/auth-guard';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Avatar } from '@/components/ui/avatar/avatar';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { LogOut01, Settings01 } from '@untitledui/icons';
import { Link } from '@/i18n/routing';
import { cx } from '@/utils/cx';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isFullscreen } = useSidebarStore();
  const { user, logout } = useAuthStore();

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-secondary">
        <DashboardSidebar />

        <main className="flex flex-1 flex-col">
          {/* Top bar - hidden in fullscreen mode */}
          <header
            className={cx(
              'sticky top-0 z-40 flex h-14 items-center justify-end gap-1 border-b border-secondary bg-primary px-3 lg:px-4',
              isFullscreen && 'hidden'
            )}
          >
            <LocaleSwitcher />
            <ThemeToggle />

            <div className="mx-1 h-6 w-px bg-border-secondary" />

            <Dropdown.Root>
              <Dropdown.Button className="flex items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-primary_hover">
                <Avatar
                  size="sm"
                  initials={user?.firstName?.[0]?.toUpperCase()}
                  status="online"
                />
                <div className="hidden text-left lg:block">
                  <p className="text-sm font-medium leading-tight text-primary">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs leading-tight text-tertiary">{user?.email}</p>
                </div>
              </Dropdown.Button>
              <Dropdown.Popover className="w-56">
                <Dropdown.Menu>
                  <Dropdown.Item icon={Settings01}>
                    <Link href="/settings" className="block w-full">Einstellungen</Link>
                  </Dropdown.Item>
                  <Dropdown.Separator />
                  <Dropdown.Item icon={LogOut01} onAction={logout}>
                    Abmelden
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </header>

          {/* Main content area */}
          <div className={cx('flex-1', !isFullscreen && 'p-4 lg:p-6')}>{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
