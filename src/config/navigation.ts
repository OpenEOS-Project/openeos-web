import {
  BarChartSquare02,
  Inbox01,
  LayoutGrid01,
  Building07,
  Calendar,
  ClipboardCheck,
  HardDrive,
  LineChartUp01,
  MarkerPin01,
  MessageChatCircle,
  PackageSearch,
  Printer,
  Receipt,
  Settings01,
  Coins01,
  ShoppingBag01,
  Tablet02,
  PuzzlePiece01,
  ReceiptCheck,
  Tag01,
  Users01,
} from '@untitledui/icons';

import type { NavItemDividerType, NavItemType } from '@/components/app-navigation/config';
import { getEnabledIntegrations, integrationHref } from '@/config/integrations';
import type { OrganizationSettings } from '@/types/organization';

// Super-Admin navigation items (can see everything across all organizations)
export const superAdminNavItems: NavItemType[] = [
  {
    labelKey: 'dashboard',
    href: '/dashboard',
    icon: BarChartSquare02,
  },
  {
    labelKey: 'organizations',
    href: '/organizations',
    saasOnly: true,
    icon: Building07,
  },
  {
    labelKey: 'users',
    href: '/users',
    icon: Users01,
  },
  {
    labelKey: 'rentalHardware',
    href: '/admin/rental-hardware',
    saasOnly: true,
    icon: HardDrive,
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
    // Nicht schlicht "Support": der Fusseintrag heisst schon so und
    // fuehrt zum eigenen Chat mit dem Support. Hier geht es um den
    // Posteingang aller Organisationen — beides nebeneinander in der
    // Seitenleiste war nicht unterscheidbar.
    labelKey: 'adminSupport',
    href: '/admin/support',
    saasOnly: true,
    icon: MessageChatCircle,
  },
  {
    // Was über die Website hereinkommt. Getrennt vom Support, weil hier
    // niemand auf Antwort wartet — Wünsche liest man in Ruhe durch.
    labelKey: 'adminFeedback',
    href: '/admin/feedback',
    saasOnly: true,
    icon: Inbox01,
  },
];

// Organization admin/member navigation items, grouped by domain:
// laufender Betrieb → Sortiment → Hardware/Standorte → Organisation & Auswertung
export const dashboardNavItems: (NavItemType | NavItemDividerType)[] = [
  {
    labelKey: 'dashboard',
    href: '/dashboard',
    icon: BarChartSquare02,
  },
  {
    labelKey: 'orders',
    href: '/orders',
    icon: Receipt,
  },
  { divider: true },
  {
    labelKey: 'products',
    href: '/products',
    icon: ShoppingBag01,
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
    icon: Tag01,
    requiredPermission: 'discounts',
  },
  {
    labelKey: 'pfand',
    href: '/pfand',
    icon: Coins01,
    requiredPermission: 'pfand',
  },
  { divider: true },
  {
    labelKey: 'devices',
    href: '/devices',
    icon: Tablet02,
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
    icon: MarkerPin01,
    requiredPermission: 'products',
  },
  {
    // Bereiche, Tische und Tischplan der Organisation. Recht wie die API:
    // wer Veranstaltungen verwaltet, verwaltet auch deren Tische.
    labelKey: 'tables',
    href: '/tables',
    icon: LayoutGrid01,
    requiredPermission: 'events',
  },
  { divider: true },
  {
    labelKey: 'members',
    href: '/members',
    icon: Users01,
    requiredPermission: 'members',
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
    icon: LineChartUp01,
    requiredPermission: 'reports',
  },
  {
    // Abrechnungsdaten der Organisation — es gibt kein Berechtigungsmodul
    // dafuer, und Mitglieder haben darin nichts zu suchen.
    labelKey: 'invoices',
    href: '/invoices',
    saasOnly: true,
    icon: ReceiptCheck,
    adminOnly: true,
  },
  {
    // Zugangsdaten zu fremden Diensten; dasselbe Argument wie oben.
    labelKey: 'integrations',
    href: '/integrations',
    icon: PuzzlePiece01,
    adminOnly: true,
  },
  { divider: true },
  {
    labelKey: 'support',
    href: '/support',
    saasOnly: true,
    icon: MessageChatCircle,
  },
];

export const dashboardFooterItems: NavItemType[] = [
  {
    labelKey: 'settings',
    href: '/settings',
    icon: Settings01,
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
