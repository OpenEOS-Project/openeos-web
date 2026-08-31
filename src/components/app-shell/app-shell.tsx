'use client';

import { Menu02 } from '@untitledui/icons';

import { ToastViewport } from '@/components/shared/toast';
import { useSidebarStore } from '@/stores/sidebar-store';
import { AppBreadcrumbs } from './app-breadcrumbs';
import { AppSidebar } from './app-sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Grundgeruest des Admin-Bereichs.
 *
 * Die frueher hier eingehaengte Topbar ist entfallen: sie trug nur
 * Brotkrumen, Sprachwahl und Benutzernamen. Die Brotkrumen stehen jetzt
 * im Inhaltsbereich, alles Uebrige im Fuss der Seitenleiste. Auf
 * schmalen Viewports, wo die Seitenleiste ausgeblendet ist, bleibt ein
 * schwebender Knopf als einziger Zugang zur Navigation.
 */
export function AppShell({ children }: AppShellProps) {
  const { isCollapsed, isFullscreen, setMobileOpen } = useSidebarStore();

  const sidebarWidth = isCollapsed ? 72 : 260;

  return (
    <div className="landing app-shell" style={{ display: 'block', minHeight: '100vh' }}>
      <AppSidebar />

      <div
        className="app-shell__main"
        style={{
          marginLeft: isFullscreen ? 0 : sidebarWidth,
          transition: 'margin-left 0.2s ease',
        }}
      >
        <main className="app-content">
          {!isFullscreen && <AppBreadcrumbs />}
          {children}
        </main>
      </div>

      {!isFullscreen && (
        <button
          type="button"
          className="app-shell__menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Navigation öffnen"
        >
          <Menu02 />
        </button>
      )}

      <ToastViewport />

      {/* Auf Mobil traegt der Inhalt die volle Breite; die Seitenleiste
          faehrt als Overlay ueber ihn. */}
      <style>{`
        @media (max-width: 960px) {
          .landing .app-shell__main {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
