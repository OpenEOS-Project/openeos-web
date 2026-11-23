import {
  BookOpen,
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
  UserRoundCog,
  Users,
} from 'lucide-react';

import type { NavItemType, NavSectionType } from '@/components/app-navigation/config';
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
    // Neue Fassungen der Rechtstexte ankündigen (Mail an alle Admins).
    labelKey: 'adminLegal',
    href: '/admin/legal',
    saasOnly: true,
    icon: Scale,
  },
  {
    // Meldungen rechtswidriger Inhalte (Art. 16 DSA) – auch eigene
    // Installationen hosten Shops und Helferseiten.
    labelKey: 'adminReports',
    href: '/admin/reports',
    icon: Flag,
  },
];

/** Dokumentation je Sprache (liegt an der Wurzel von docs.openeos.de). */
export function docsUrl(locale: string): string {
  return locale === 'en' ? 'https://docs.openeos.de/en' : 'https://docs.openeos.de';
}

/*
 * Navigation für Admins und Mitglieder einer Organisation, in Gruppen:
 *
 * - oben ohne Überschrift: Dashboard und Veranstaltungen
 * - die gewählte Veranstaltung (Überschrift = ihr Name): was nur für sie gilt
 * - Kasse & Geräte: Hardware und Personal, für alle Veranstaltungen
 * - Bezahlen: entfällt in „Nur Bons“ ganz, dort kassiert niemand in OpenEOS
 * - Organisation: Mitglieder, Abrechnung, Integrationen, Einstellungen
 * - unten Hilfe & Support
 *
 * Die Flags je Eintrag (requiredPermission, adminOnly, cashOnly, saasOnly)
 * gelten unverändert; leere Gruppen blendet die Seitenleiste aus.
 */
export const dashboardNavSections: NavSectionType[] = [
  {
    id: 'main',
    items: [
      {
        labelKey: 'dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        labelKey: 'events',
        href: '/events',
        icon: Calendar,
        requiredPermission: 'events',
      },
    ],
  },
  {
    id: 'event',
    labelKey: 'event',
    dynamicLabel: 'eventName',
    items: [
      {
        // Produkte und Kategorien in einem Eintrag; /categories ist der
        // zweite Reiter der Produktseite.
        labelKey: 'products',
        href: '/products',
        icon: ShoppingBag,
        requiredPermission: 'products',
        activePaths: ['/categories'],
      },
      {
        labelKey: 'productionStations',
        href: '/production-stations',
        icon: MapPin,
        requiredPermission: 'products',
      },
      {
        labelKey: 'shiftPlan',
        href: '/shifts',
        icon: ClipboardCheck,
        requiredPermission: 'shiftPlans',
      },
      {
        labelKey: 'orders',
        href: '/orders',
        icon: ReceiptText,
      },
      {
        labelKey: 'inventory',
        href: '/inventory',
        icon: PackageSearch,
        requiredPermission: 'inventory',
      },
      {
        labelKey: 'reports',
        href: '/reports',
        icon: ChartLine,
        requiredPermission: 'reports',
      },
    ],
  },
  {
    id: 'till',
    labelKey: 'till',
    items: [
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
        // Bereiche, Tische und Tischplan der Organisation. Recht wie die API:
        // wer Veranstaltungen verwaltet, verwaltet auch deren Tische.
        labelKey: 'tables',
        href: '/tables',
        icon: LayoutGrid,
        requiredPermission: 'events',
      },
      {
        // Kassenprofile mit PIN (ohne Konto) fuer gemeinsam genutzte Kassen.
        labelKey: 'waiters',
        href: '/waiters',
        icon: UserRoundCheck,
        requiredPermission: 'waiters',
      },
    ],
  },
  {
    id: 'payments',
    labelKey: 'payments',
    // „Nur Bons“: kassiert wird außerhalb von OpenEOS — Pfand, Rabatt,
    // Wertmarken und Kassenbuch haben dort keinen Gegenstand.
    isVisible: ({ ordersOnly }) => !ordersOnly,
    items: [
      {
        labelKey: 'pfand',
        href: '/pfand',
        icon: Recycle,
        requiredPermission: 'pfand',
      },
      {
        labelKey: 'discounts',
        href: '/discounts',
        icon: Tag,
        requiredPermission: 'discounts',
      },
      {
        // Wertmarken: Markentypen und Auswertung. Auch sichtbar, wo die Kasse
        // keine Marken annimmt — die Seite erklärt dann, warum.
        labelKey: 'tokens',
        href: '/tokens',
        icon: Coins,
        requiredPermission: 'products',
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
    ],
  },
  {
    id: 'organization',
    labelKey: 'organization',
    items: [
      {
        labelKey: 'members',
        href: '/members',
        icon: Users,
        requiredPermission: 'members',
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
      {
        // Öffnet direkt die Organisationsreiter; die persönlichen
        // Einstellungen liegen im Menü am Benutzer unten.
        labelKey: 'settings',
        href: '/settings',
        search: 'tab=org-general',
        icon: Settings,
      },
      {
        // Rechtstexte von OpenEOS, Angaben fuers Finanzamt, Vorlage fuer den
        // Datenschutzhinweis im Shop.
        labelKey: 'legal',
        href: '/legal',
        icon: Scale,
      },
    ],
  },
  {
    id: 'help',
    items: [
      {
        // Chat mit dem Support — nur im gehosteten Betrieb.
        labelKey: 'help',
        href: '/support',
        saasOnly: true,
        icon: MessagesSquare,
      },
      {
        labelKey: 'docs',
        externalHref: docsUrl,
        tourId: 'docs',
        icon: BookOpen,
      },
    ],
  },
];

/** Menü am Benutzer: nur Persönliches (Profil, Konto, Sicherheit …). */
export const dashboardFooterItems: NavItemType[] = [
  {
    labelKey: 'personalSettings',
    href: '/settings',
    search: 'tab=profile',
    icon: UserRoundCog,
  },
];

/** Super-Admins ohne Organisationsnavigation: Einstellungen und Rechtliches bleiben im Menü. */
export const superAdminFooterItems: NavItemType[] = [
  {
    labelKey: 'settings',
    href: '/settings',
    icon: Settings,
  },
  {
    labelKey: 'legal',
    href: '/legal',
    icon: Scale,
  },
];

/**
 * Fügt für jede aktive Integration einen Eintrag direkt unter
 * "Integrationen" ein (in derselben Gruppe).
 *
 * Dynamisch statt fest in der Liste oben: welche Einträge es gibt, hängt
 * vom Schalter in den Organisationseinstellungen ab. Die Einträge sind wie
 * "Integrationen" nur für Admins (adminOnly) — canSeeNavItem filtert sie
 * danach mit denselben Regeln wie alle anderen.
 */
export function withIntegrationNavItems(
  sections: NavSectionType[],
  settings: Partial<OrganizationSettings> | null | undefined,
): NavSectionType[] {
  const integrationItems: NavItemType[] = getEnabledIntegrations(settings).map((integration) => ({
    label: integration.name,
    href: integrationHref(integration.id),
    icon: integration.navIcon,
    adminOnly: true,
    nested: true,
  }));
  if (integrationItems.length === 0) return sections;

  return sections.map((section) => {
    const index = section.items.findIndex((item) => item.href === '/integrations');
    if (index === -1) return section;
    return {
      ...section,
      items: [...section.items.slice(0, index + 1), ...integrationItems, ...section.items.slice(index + 1)],
    };
  });
}
