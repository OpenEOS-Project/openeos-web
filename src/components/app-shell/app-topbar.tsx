'use client';

import { usePathname } from 'next/navigation';
import { Menu02 } from '@untitledui/icons';

import { Link } from '@/i18n/routing';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';

// Map path segments to human-readable labels
const pathLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  events: 'Events',
  products: 'Produkte',
  categories: 'Kategorien',
  members: 'Mitglieder',
  devices: 'Geräte',
  printers: 'Drucker',
  orders: 'Bestellungen',
  shifts: 'Schichtpläne',
  settings: 'Einstellungen',
  organizations: 'Organisationen',
  users: 'Benutzer',
  admin: 'Admin',
  'rental-hardware': 'Miet-Hardware',
  'production-stations': 'Produktionsstandorte',
  templates: 'Vorlagen',
};

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

function buildBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  // Strip locale prefix
  const stripped = pathname.replace(/^\/(de|en)/, '');
  const segments = stripped.split('/').filter(Boolean);

  const crumbs: BreadcrumbSegment[] = [{ label: 'Dashboard', href: '/dashboard' }];

  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
    return crumbs;
  }

  let currentPath = '';
  for (const seg of segments) {
    currentPath += '/' + seg;
    // Skip UUIDs/IDs
    if (/^[0-9a-f-]{20,}$/i.test(seg)) {
      crumbs.push({ label: 'Details' });
      continue;
    }
    const label = pathLabels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
    crumbs.push({ label, href: currentPath });
  }

  // Make last crumb non-linkable
  if (crumbs.length > 0) {
    crumbs[crumbs.length - 1] = { label: crumbs[crumbs.length - 1].label };
  }

  return crumbs;
}

export function AppTopbar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { setMobileOpen } = useSidebarStore();

  const crumbs = buildBreadcrumbs(pathname);
  const initials = user?.firstName?.[0]?.toUpperCase() ?? '?';

  return (
    <header className="app-topbar">
      <div className="app-topbar__left">
        {/* Mobile menu button */}
        <button
          className="app-topbar__menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Navigation öffnen"
        >
          <Menu02 />
        </button>

        {/* Breadcrumb */}
        <nav className="app-topbar__breadcrumb" aria-label="Breadcrumb">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <span className="app-topbar__breadcrumb-sep">/</span>}
                {isLast || !crumb.href ? (
                  <span className={isLast ? 'app-topbar__breadcrumb-current' : undefined}>
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={crumb.href as any}>{crumb.label}</Link>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      <div className="app-topbar__right">
        {/* Locale switcher */}
        <LocaleSwitcher />

        <div className="app-topbar__divider" />

        {/* User avatar */}
        <div className="app-topbar__avatar-btn" style={{ cursor: 'default' }}>
          <div className="app-topbar__avatar">{initials}</div>
          <span className="app-topbar__user-name">
            {user?.firstName} {user?.lastName}
          </span>
        </div>
      </div>
    </header>
  );
}
