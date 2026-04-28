import {
  BarChartSquare02,
  Building07,
  Calendar,
  ClipboardCheck,
  HardDrive,
  Printer,
  Receipt,
  Settings01,
  ShoppingBag01,
  Tablet02,
  Users01,
} from '@untitledui/icons';

import type { NavItemType } from '@/components/app-navigation/config';

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
    label: 'Events & Abrechnung',
    href: '/admin/events',
    icon: Calendar,
  },
];

// Organization admin/member navigation items
export const dashboardNavItems: NavItemType[] = [
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
  {
    label: 'Mitglieder',
    href: '/members',
    icon: Users01,
    requiredPermission: 'members',
  },
  {
    label: 'Events',
    href: '/events',
    icon: Calendar,
    requiredPermission: 'events',
  },
  {
    label: 'Produktverwaltung',
    href: '/products',
    icon: ShoppingBag01,
    requiredPermission: 'products',
    items: [
      { label: 'Produkte', href: '/products' },
      { label: 'Kategorien', href: '/categories' },
      { label: 'Standorte', href: '/production-stations' },
    ],
  },
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
    label: 'Schichtpläne',
    href: '/shifts',
    icon: ClipboardCheck,
    requiredPermission: 'shiftPlans',
  },
];

export const dashboardFooterItems: NavItemType[] = [
  {
    label: 'Einstellungen',
    href: '/settings',
    icon: Settings01,
  },
];
