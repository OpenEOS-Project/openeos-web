'use client';

import { useSidebarStore } from '@/stores/sidebar-store';
import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isCollapsed, isFullscreen } = useSidebarStore();

  const sidebarWidth = isCollapsed ? 72 : 260;

  return (
    <div className="landing app-shell" style={{ display: 'block', minHeight: '100vh' }}>
      {/* Sidebar */}
      <AppSidebar />

      {/* Main area — offset by sidebar width on desktop */}
      <div
        className="app-shell__main"
        style={{
          marginLeft: isFullscreen ? 0 : sidebarWidth,
          transition: 'margin-left 0.2s ease',
        }}
      >
        {!isFullscreen && <AppTopbar />}
        <main className="app-content">{children}</main>
      </div>

      {/* Responsive: override margin-left on mobile */}
      <style>{`
        @media (max-width: 960px) {
          .landing .app-shell__main {
            margin-left: 0 !important;
            padding-top: 56px;
          }
        }
      `}</style>
    </div>
  );
}
