import {
  BarChartSquare02,
  Building07,
  Calendar,
  ClipboardCheck,
  HardDrive,
  LineChartUp01,
  MarkerPin01,
  PackageSearch,
  Printer,
  Receipt,
  Settings01,
  Coins01,
  ShoppingBag01,
  Tablet02,
  Tag01,
  Users01,
} from '@untitledui/icons';

import type { NavItemDividerType, NavItemType } from '@/components/app-navigation/config';

// Super-Admin navigation items (can see everything across all organizations)
export const superAdminNavItems: NavItemType[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: BarChartSquare02,
  },
  {
    label: 'Organisationen',
    href: '/organizations',
    icon: Building07,
  },
  {
    label: 'Benutzer',
    href: '/users',
    icon: Users01,
  },
  {
    label: 'Miet-Hardware',
    href: '/admin/rental-hardware',
    icon: HardDrive,
  },
  {
    label: 'Drucker',
    href: '/admin/printers',
    icon: Printer,
  },
  {
    label: 'Events & Abrechnung',
    href: '/admin/events',
    icon: Calendar,
  },
];

// Organization admin/member navigation items, grouped by domain:
// laufender Betrieb → Sortiment → Hardware/Standorte → Organisation & Auswertung
export const dashboardNavItems: (NavItemType | NavItemDividerType)[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: BarChartSquare02,
  },
  {
    label: 'Bestellungen',
    href: '/orders',
    icon: Receipt,
  },
  { divider: true },
  {
    label: 'Produkte',
    href: '/products',
    icon: ShoppingBag01,
    requiredPermission: 'products',
    items: [
      { label: 'Kategorien', href: '/categories' },
    ],
  },
  {
    label: 'Inventur',
    href: '/inventory',
    icon: PackageSearch,
    requiredPermission: 'inventory',
  },
  {
    label: 'Rabatt-Bons',
    href: '/discounts',
    icon: Tag01,
    requiredPermission: 'discounts',
  },
  {
    label: 'Pfand',
    href: '/pfand',
    icon: Coins01,
    requiredPermission: 'pfand',
  },
  { divider: true },
  {
    label: 'Geräte',
    href: '/devices',
    icon: Tablet02,
    requiredPermission: 'devices',
  },
  {
    label: 'Drucker',
    href: '/printers',
    icon: Printer,
    requiredPermission: 'devices',
  },
  {
    label: 'Standorte',
    href: '/production-stations',
    icon: MarkerPin01,
    requiredPermission: 'products',
  },
  { divider: true },
  {
    label: 'Mitglieder',
    href: '/members',
    icon: Users01,
    requiredPermission: 'members',
  },
  {
    label: 'Schichtpläne',
    href: '/shifts',
    icon: ClipboardCheck,
    requiredPermission: 'shiftPlans',
  },
  {
    label: 'Events',
    href: '/events',
    icon: Calendar,
    requiredPermission: 'events',
  },
  {
    label: 'Auswertung',
    href: '/reports',
    icon: LineChartUp01,
    requiredPermission: 'reports',
  },
];

export const dashboardFooterItems: NavItemType[] = [
  {
    label: 'Einstellungen',
    href: '/settings',
    icon: Settings01,
  },
];
