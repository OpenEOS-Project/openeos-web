import {
  BookOpenText,
  Building,
  Calendar,
  ChartLine,
  ClipboardCheck,
  Coins,
  Flag,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  MessagesSquare,
  PackageSearch,
  Printer,
  Puzzle,
  ReceiptEuro,
  ReceiptText,
  Recycle,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingBag,
  TabletSmartphone,
  Tag,
  Trash2,
  UserRoundCheck,
  Users,
} from 'lucide-react';

import type { NavItemDividerType, NavItemType } from '@/components/app-navigation/config';
import { getEnabledIntegrations, integrationHref } from '@/config/integrations';
import type { OrganizationSettings } from '@/types/organization';

// Super-Admin navigation items (can see everything across all organizations)
export const superAdminNavItems: NavItemType[] = [
  {
    labelKey: 'dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'organizations',
    href: '/organizations',
    saasOnly: true,
    icon: Building,
  },
  {
    labelKey: 'users',
    href: '/users',
    icon: Users,
  },
  {
    labelKey: 'printers',
    href: '/admin/printers',
    icon: Printer,
  },
  {
    labelKey: 'adminEvents',
    href: '/admin/events',
    saasOnly: true,
    icon: Calendar,
  },
  {
    // Alle Cloud-TSEs mit Abmeldung zum Monatsende (Kostenkontrolle).
    labelKey: 'adminTse',
    href: '/admin/tse',
    icon: ShieldCheck,
  },
  {
    // Protokoll der Löschläufe und Löschungen (auch durch Vereine selbst).
    labelKey: 'adminRetention',
    href: '/admin/retention',
    saasOnly: true,
    icon: Trash2,
  },
  {
    // Nicht schlicht "Support": der Fusseintrag heisst schon so und
    // fuehrt zum eigenen Chat mit dem Support. Hier geht es um den
    // Posteingang aller Organisationen — beides nebeneinander in der
    // Seitenleiste war nicht unterscheidbar.
    labelKey: 'adminSupport',
    href: '/admin/support',
    saasOnly: true,
    icon: MessagesSquare,
  },
  {
    // Was über die Website hereinkommt. Getrennt vom Support, weil hier
    // niemand auf Antwort wartet — Wünsche liest man in Ruhe durch.
    labelKey: 'adminFeedback',
    href: '/admin/feedback',
    saasOnly: true,
    icon: Inbox,
  },
  {
    // Meldungen rechtswidriger Inhalte (Art. 16 DSA) – auch eigene
    // Installationen hosten Shops und Helferseiten.
    labelKey: 'adminReports',
    href: '/admin/reports',
    icon: Flag,
  },
];

// Organization admin/member navigation items, grouped by domain:
// laufender Betrieb → Sortiment → Hardware/Standorte → Organisation & Auswertung
export const dashboardNavItems: (NavItemType | NavItemDividerType)[] = [
  {
    labelKey: 'dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'orders',
    href: '/orders',
    icon: ReceiptText,
  },
  {
    // Bargeld der Kasse (Anfangsbestand, Einlagen, Entnahmen, Kassensturz).
    // Nur mit Bargeld — sonst gibt es nichts zu buchen.
    labelKey: 'cashbook',
    href: '/cashbook',
    icon: BookOpenText,
    adminOnly: true,
    cashOnly: true,
  },
  { divider: true },
  {
    labelKey: 'products',
    href: '/products',
    icon: ShoppingBag,
    requiredPermission: 'products',
  },
  {
    labelKey: 'inventory',
    href: '/inventory',
    icon: PackageSearch,
    requiredPermission: 'inventory',
  },
  {
    labelKey: 'discounts',
    href: '/discounts',
    icon: Tag,
    requiredPermission: 'discounts',
  },
  {
    labelKey: 'pfand',
    href: '/pfand',
    icon: Recycle,
    requiredPermission: 'pfand',
  },
  {
    // Wertmarken: Markentypen und Auswertung. Auch sichtbar, wo die Kasse
    // keine Marken annimmt — die Seite erklärt dann, warum.
    labelKey: 'tokens',
    href: '/tokens',
    icon: Coins,
    requiredPermission: 'products',
  },
  { divider: true },
  {
    labelKey: 'devices',
    href: '/devices',
    icon: TabletSmartphone,
    requiredPermission: 'devices',
  },
  {
    labelKey: 'printers',
    href: '/printers',
    icon: Printer,
    requiredPermission: 'devices',
  },
  {
    labelKey: 'productionStations',
    href: '/production-stations',
    icon: MapPin,
    requiredPermission: 'products',
  },
  {
    // Bereiche, Tische und Tischplan der Organisation. Recht wie die API:
    // wer Veranstaltungen verwaltet, verwaltet auch deren Tische.
    labelKey: 'tables',
    href: '/tables',
    icon: LayoutGrid,
    requiredPermission: 'events',
  },
  { divider: true },
  {
    labelKey: 'members',
    href: '/members',
    icon: Users,
    requiredPermission: 'members',
  },
  {
    // Kassenprofile mit PIN (ohne Konto) fuer gemeinsam genutzte Kassen.
    labelKey: 'waiters',
    href: '/waiters',
    icon: UserRoundCheck,
    requiredPermission: 'waiters',
  },
  {
    labelKey: 'shifts',
    href: '/shifts',
    icon: ClipboardCheck,
    requiredPermission: 'shiftPlans',
  },
  {
    labelKey: 'events',
    href: '/events',
    icon: Calendar,
    requiredPermission: 'events',
  },
  {
    labelKey: 'reports',
    href: '/reports',
    icon: ChartLine,
    requiredPermission: 'reports',
  },
  {
    // Abrechnungsdaten der Organisation — es gibt kein Berechtigungsmodul
    // dafuer, und Mitglieder haben darin nichts zu suchen.
    labelKey: 'invoices',
    href: '/invoices',
    saasOnly: true,
    icon: ReceiptEuro,
    adminOnly: true,
  },
  {
    // Zugangsdaten zu fremden Diensten; dasselbe Argument wie oben.
    labelKey: 'integrations',
    href: '/integrations',
    icon: Puzzle,
    adminOnly: true,
  },
  { divider: true },
  {
    labelKey: 'support',
    href: '/support',
    saasOnly: true,
    icon: MessagesSquare,
  },
];

export const dashboardFooterItems: NavItemType[] = [
  {
    labelKey: 'settings',
    href: '/settings',
    icon: Settings,
  },
  {
    // Rechtstexte von OpenEOS, Angaben fuers Finanzamt, Vorlage fuer den
    // Datenschutzhinweis im Shop.
    labelKey: 'legal',
    href: '/legal',
    icon: Scale,
  },
];

/**
 * Fügt für jede aktive Integration einen Eintrag direkt unter
 * "Integrationen" ein.
 *
 * Dynamisch statt fest in der Liste oben: welche Einträge es gibt, hängt
 * vom Schalter in den Organisationseinstellungen ab. Die Einträge sind wie
 * "Integrationen" nur für Admins (adminOnly) — canSeeNavItem filtert sie
 * danach mit denselben Regeln wie alle anderen.
 */
export function withIntegrationNavItems(
  items: (NavItemType | NavItemDividerType)[],
  settings: Partial<OrganizationSettings> | null | undefined,
): (NavItemType | NavItemDividerType)[] {
  const index = items.findIndex((item) => !item.divider && item.href === '/integrations');
  if (index === -1) return items;

  const integrationItems: NavItemType[] = getEnabledIntegrations(settings).map((integration) => ({
    label: integration.name,
    href: integrationHref(integration.id),
    icon: integration.navIcon,
    adminOnly: true,
    nested: true,
  }));
  if (integrationItems.length === 0) return items;

  return [...items.slice(0, index + 1), ...integrationItems, ...items.slice(index + 1)];
}
