import {
  BarChartSquare02,
  Building07,
  Calendar,
  ClipboardCheck,
  CoinsStacked01,
  CreditCard01,
  Printer,
  Receipt,
  Settings01,
  ShoppingBag01,
  Shield01,
  Tablet02,
  Users01,
  Zap,
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
    label: 'Preise & Pakete',
    href: '/admin/pricing',
    icon: CoinsStacked01,
  },
  {
    label: 'System',
    href: '/system',
    icon: Shield01,
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
  },
  {
    label: 'Events',
    href: '/events',
    icon: Calendar,
  },
  {
    label: 'Produkte',
    href: '/products',
    icon: ShoppingBag01,
  },
  {
    label: 'Geräte',
    href: '/devices',
    icon: Tablet02,
  },
  {
    label: 'Drucker',
    href: '/printers',
    icon: Printer,
  },
  {
    label: 'Workflows',
    href: '/workflows',
    icon: Zap,
  },
  {
    label: 'Schichtpläne',
    href: '/shifts',
    icon: ClipboardCheck,
  },
];

export const dashboardFooterItems: NavItemType[] = [
  {
    label: 'Abrechnung',
    href: '/billing',
    icon: CreditCard01,
    roles: ['admin'], // Only organization admins can see billing
  },
  {
    label: 'Einstellungen',
    href: '/settings',
    icon: Settings01,
  },
];
