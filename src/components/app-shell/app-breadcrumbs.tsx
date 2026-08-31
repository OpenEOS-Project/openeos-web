'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';

/**
 * Brotkrumen des Admin-Bereichs.
 *
 * Saß früher in der Topbar. Die ist entfallen, deshalb stehen sie jetzt
 * im Inhaltsbereich über dem Seitenkopf — so wie in der Designvorlage,
 * wo sie Teil des Seitenkopfs sind und keine eigene Leiste bilden.
 */

interface Crumb {
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

export function AppBreadcrumbs() {
  const pathname = usePathname();
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

  const stripped = pathname.replace(/^\/(de|en)(?=\/|$)/, '');
  const segments = stripped.split('/').filter(Boolean);

  // Auf dem Dashboard selbst waere die Krume nur eine Wiederholung der
  // Ueberschrift — dann lieber nichts zeigen.
  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
    return null;
  }

  const crumbs: Crumb[] = [{ label: tNav('dashboard'), href: '/dashboard' }];
  let current = '';
  for (const seg of segments) {
    current += '/' + seg;
    if (/^[0-9a-f-]{20,}$/i.test(seg)) {
      crumbs.push({
        label: (() => {
          try {
            return tCommon('details');
          } catch {
            return 'Details';
          }
        })(),
      });
      continue;
    }
    crumbs.push({ label: labelFor(seg), href: current });
  }

  // Die letzte Krume ist die aktuelle Seite und deshalb kein Link.
  const last = crumbs[crumbs.length - 1];
  if (last) last.href = undefined;

  return (
    <nav className="oe-crumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span aria-hidden>/</span>}
          {crumb.href ? (
            <Link href={crumb.href as never}>{crumb.label}</Link>
          ) : (
            <span aria-current="page">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
