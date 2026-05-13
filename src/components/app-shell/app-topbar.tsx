'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Menu02 } from '@untitledui/icons';

import { Link } from '@/i18n/routing';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

const SEG_TO_NAV_KEY: Record<string, string> = {
  dashboard: 'dashboard',
  events: 'events',
  products: 'products',
  categories: 'categories',
  members: 'members',
  devices: 'devices',
  printers: 'printers',
  orders: 'orders',
  shifts: 'shifts',
  settings: 'settings',
  organizations: 'organizations',
  users: 'users',
  admin: 'admin',
  'rental-hardware': 'rentalHardware',
  'production-stations': 'productionStations',
  templates: 'templates',
};

function humanize(seg: string): string {
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
}

export function AppTopbar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { setMobileOpen } = useSidebarStore();
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const labelFor = (seg: string): string => {
    const key = SEG_TO_NAV_KEY[seg];
    if (!key) return humanize(seg);
    try {
      return tNav(key);
    } catch {
      return humanize(seg);
    }
  };

  const buildBreadcrumbs = (path: string): BreadcrumbSegment[] => {
    const stripped = path.replace(/^\/(de|en)(?=\/|$)/, '');
    const segments = stripped.split('/').filter(Boolean);

    const crumbs: BreadcrumbSegment[] = [{ label: tNav('dashboard'), href: '/dashboard' }];

    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
      return crumbs;
    }

    let currentPath = '';
    for (const seg of segments) {
      currentPath += '/' + seg;
      if (/^[0-9a-f-]{20,}$/i.test(seg)) {
        crumbs.push({ label: (() => { try { return tCommon('details'); } catch { return 'Details'; } })() });
        continue;
      }
      crumbs.push({ label: labelFor(seg), href: currentPath });
    }

    if (crumbs.length > 0) {
      crumbs[crumbs.length - 1] = { label: crumbs[crumbs.length - 1].label };
    }

    return crumbs;
  };

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
