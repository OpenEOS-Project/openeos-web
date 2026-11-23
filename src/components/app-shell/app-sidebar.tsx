'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  Globe,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Plus,
  Sun,
} from 'lucide-react';

import { CreateOrgModal } from './create-org-modal';
import { Logo } from '@/components/foundations/logo/logo';
import {
  Dropdown,
  DropdownCaption,
  DropdownLink,
  DropdownOption,
  DropdownSeparator,
  useMediaQuery,
} from '@openeos/ui';

import { useTheme } from 'next-themes';

import {
  Link,
  usePathname as useLocalePathname,
  useRouter as useLocaleRouter,
} from '@/i18n/routing';
import {
  dashboardFooterItems,
  dashboardNavSections,
  superAdminFooterItems,
  superAdminNavItems,
  withIntegrationNavItems,
} from '@/config/navigation';
import { useMyInvitations } from '@/hooks/use-members';
import { useActiveEvent } from '@/hooks/use-events';
import { phaseMoment, useEventPhase } from '@/lib/event-phase';
import { useIntlLocale } from '@/hooks/use-locale-format';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { isCashAllowed } from '@/lib/operating-mode';
import { useOperatingMode } from '@/hooks/use-operating-mode';
import type { NavItemType, NavSectionType } from '@/components/app-navigation/config';
import { cx } from '@/utils/cx';
import { seatUsage } from '@/utils/limits';
import { APP_VERSION } from '@/lib/version';
import { SourceCodeLink } from '@/components/shared/source-code-link';
import { useReleaseVersion } from '@/hooks/use-release-version';
import { useDeployment } from '@/components/providers/setup-provider';

/** Mobil zugeklappte Gruppen (ids), gemerkt über Sitzungen hinweg. */
const CLOSED_GROUPS_KEY = 'openeos.sidebar.closedGroups';
/** Ab hier ist die Seitenleiste eine Schublade (siehe landing.css). */
const DRAWER_QUERY = '(max-width: 960px)';

function readClosedGroups(): string[] {
  try {
    const raw = window.localStorage.getItem(CLOSED_GROUPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations('shell');
  const tNav = useTranslations('navigation');
  const tRoles = useTranslations('members.roles');
  const tTheme = useTranslations('theme');
  const tAuth = useTranslations('auth');
  /* Feste Eintraege tragen einen Schluessel, Integrationen ihren
     Markennamen — der bleibt in jeder Sprache gleich. */
  const navLabel = (item: NavItemType) =>
    item.labelKey ? tNav(item.labelKey) : (item.label ?? '');
  const roleLabel = (role: string) =>
    role === 'admin' || role === 'member' ? tRoles(role) : role;
  const {
    user,
    organizations,
    currentOrganization,
    setCurrentOrganization,
    setOrganizations,
    logout,
    isLoading,
  } = useAuthStore();
  const { isCollapsed, isMobileOpen, toggleCollapsed, setMobileOpen } = useSidebarStore();

  /* Solange die Nummer noch unterwegs ist — oder die API schweigt —
     steht die Build-Nummer da. Eine Leerstelle waere fuer den Support
     schlechter als die zweitbeste Angabe. */
  const releaseVersion = useReleaseVersion();
  const versionsText = releaseVersion ?? APP_VERSION;

  const orgIdForEvent = currentOrganization?.organizationId ?? '';
  const { data: activeEvent } = useActiveEvent(orgIdForEvent);
  // Phase statt Status: bezahlt, aber vor dem Termin heisst „Geplant“
  // (Testbetrieb), nach dem Ende „Beendet“.
  const activePhase = useEventPhase(activeEvent);
  const intlLocale = useIntlLocale();

  // Informational only for now — no accept/decline UI exists yet to route
  // this badge to (see the removed handleAcceptInvitation/
  // handleDeclineInvitation below, which were dead code: defined, then
  // immediately voided, never wired to anything clickable).
  const { data: pendingInvitations = [] } = useMyInvitations();

  const [orgMenuOpen, setOrgMenuOpen] = React.useState(false);
  const [createOrgOpen, setCreateOrgOpen] = React.useState(false);
  const orgWrapRef = React.useRef<HTMLDivElement | null>(null);
  /* DropdownLink rendert ein <a>; der Sprachpraefix muss deshalb selbst
     davor, anders als beim Link aus i18n/routing. */
  const locale = useLocale();

  /* Sprache und Erscheinungsbild sitzen jetzt im Menue am Benutzer statt
     als eigene Knoepfe im Fuss. Beides braucht seinen eigenen Router
     bzw. Hook — der Pfad ohne Sprachpraefix kommt aus i18n/routing. */
  const localeRouter = useLocaleRouter();
  const localePathname = useLocalePathname();
  const { theme, setTheme } = useTheme();
  /* next-themes kennt das Thema erst im Browser. Vor dem Einhaengen
     stuende sonst serverseitig ein anderes Haekchen als danach. */
  const [themeBereit, setThemeBereit] = React.useState(false);
  React.useEffect(() => setThemeBereit(true), []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!orgMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (orgWrapRef.current && !orgWrapRef.current.contains(e.target as Node)) {
        setOrgMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [orgMenuOpen]);



  const activeUrl = pathname.replace(/^\/(de|en)/, '');

  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const currentRole = currentOrganization?.role;
  const currentPermissions = currentOrganization?.permissions;
  const deployment = useDeployment();
  /* Hoechstzahl an Organisationen je Benutzer: die wirksame Schranke
     kommt mit /auth/me, gezaehlt wird die Liste im Store (sie waechst beim
     Anlegen sofort). Super-Admins sind ausgenommen. */
  const orgSeats = seatUsage(organizations.length, user?.organizationLimit);
  /* Geplante Kontolöschung: keine neue Organisation (die API lehnt ab). */
  const deletionScheduled = !!user?.deletionDueAt;
  const orgLimitReached = (orgSeats.full && !isSuperAdmin) || deletionScheduled;

  const canSeeNavItem = (item: NavItemType): boolean => {
    // Fuehrt eigenstaendig ins Leere: die Endpunkte dahinter antworten mit 404.
    if (item.saasOnly && !deployment.multiTenant) return false;
    if (item.cashOnly && !isCashAllowed(currentOrganization?.organization)) return false;
    if (item.adminOnly) return currentRole === 'admin';
    if (!item.requiredPermission) return true;
    if (currentRole === 'admin') return true;
    return !!currentPermissions?.[item.requiredPermission];
  };

  /* „Nur Bons“ blendet die Gruppe Bezahlen ganz aus. */
  const { ordersOnly } = useOperatingMode();

  /* In der Schublade (Telefon, Tablet) lassen sich Gruppen zuklappen; der
     Zustand bleibt im Browser. Eingeklappt (nur Symbole) gilt nur am
     Desktop — die Schublade ist immer breit. */
  const isDrawer = useMediaQuery(DRAWER_QUERY);
  const iconOnly = isCollapsed && !isDrawer;
  const [closedGroups, setClosedGroups] = React.useState<string[]>([]);
  React.useEffect(() => setClosedGroups(readClosedGroups()), []);
  const toggleGroup = (id: string) => {
    setClosedGroups((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
      try {
        window.localStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* Privater Modus o. Ä.: dann eben nur für diese Sitzung. */
      }
      return next;
    });
  };

  /* Eigenstaendig ist der Administrator zwar technisch Super-Admin — sonst
     kaeme er an Geraete, Drucker und Protokoll nicht heran — aber es gibt
     keine Betreiberebene ueber der Organisation. Bekaeme er hier die
     Super-Admin-Navigation, verschwaende die gesamte normale Verwaltung
     hinter einer Liste von Seiten, die es in dieser Installation gar nicht
     gibt. */
  const zeigeBetreiberNavigation = isSuperAdmin && deployment.multiTenant;

  const navSections: NavSectionType[] = zeigeBetreiberNavigation
    ? [{ id: 'main', items: superAdminNavItems.filter(canSeeNavItem) }]
    : withIntegrationNavItems(dashboardNavSections, currentOrganization?.organization?.settings)
        .filter((section) => !section.isVisible || section.isVisible({ ordersOnly }))
        .map((section) => ({ ...section, items: section.items.filter(canSeeNavItem) }))
        // Gruppen, von denen nach den Rechten nichts übrig bleibt, entfallen samt Überschrift.
        .filter((section) => section.items.length > 0);
  const navItems = navSections.flatMap((section) => section.items);
  const filteredFooterItems = zeigeBetreiberNavigation
    ? superAdminFooterItems.filter((item) => !item.adminOnly)
    : dashboardFooterItems.filter(canSeeNavItem);

  /* Überschrift der Gruppe: die Veranstaltungsgruppe heißt wie die gewählte
     Veranstaltung; ohne eine steht neutral „Veranstaltung“. */
  const sectionLabel = (section: NavSectionType): string | null => {
    if (section.dynamicLabel === 'eventName' && activeEvent?.name) return activeEvent.name;
    return section.labelKey ? tNav(`groups.${section.labelKey}`) : null;
  };


  const orgs = organizations.filter((o) => o?.organization);
  const hasMultiple = orgs.length > 1;
  const orgInitial = currentOrganization?.organization?.name?.[0]?.toUpperCase() ?? 'O';

  /* Das Menue hat nur einen Zweck, wenn es etwas zu waehlen gibt: entweder
     eine zweite Organisation oder der Punkt "Neue Organisation". Eigenstaendig
     entfaellt beides, und ein aufklappbares Menue mit genau einem Eintrag, der
     schon ausgewaehlt ist, waere nur im Weg.

     (`hasMultiple` wurde bisher berechnet und nie verwendet — hier ist die
     Stelle, an der es gemeint war.) */
  const orgMenuNutzbar = deployment.multiTenant || hasMultiple;

  const sidebarClasses = cx(
    'app-sidebar',
    isCollapsed && 'app-sidebar--collapsed',
    isMobileOpen && 'app-sidebar--mobile-open'
  );

  const matchesUrl = (href: string) => activeUrl === href || activeUrl.startsWith(href + '/');

  const renderNavItem = (item: NavItemType) => {
    const Icon = item.icon;
    const text = navLabel(item);

    /* Externe Ziele (Dokumentation) öffnen in einem neuen Tab. */
    if (item.externalHref) {
      return (
        <div
          key={`external-${item.labelKey ?? item.label}`}
          className="app-sidebar__group"
          data-tour={item.tourId ? `nav-${item.tourId}` : undefined}
        >
          <a
            href={item.externalHref(locale)}
            target="_blank"
            rel="noopener noreferrer"
            className="app-sidebar__item"
            title={iconOnly ? text : undefined}
            aria-label={iconOnly ? text : undefined}
          >
            {Icon && <Icon className="" />}
            <span className="app-sidebar__item-label">{text}</span>
            {!iconOnly && <ExternalLink className="app-sidebar__item-external" aria-hidden="true" />}
          </a>
        </div>
      );
    }

    if (!item.href) return null;
    const href = item.href;
    const subItems = item.items ?? [];
    const ownPaths = [href, ...(item.activePaths ?? [])];
    /* Liegt ein anderer Eintrag genauer auf der Adresse — etwa
       /integrations/sumup unter /integrations —, gehoert die
       Hervorhebung ihm allein, sonst leuchteten beide. */
    const hasMoreSpecificMatch = navItems.some(
      (other) => !!other.href && other.href.startsWith(href + '/') && matchesUrl(other.href),
    );
    const isActiveBranch =
      !hasMoreSpecificMatch &&
      (ownPaths.some(matchesUrl) || subItems.some((sub) => matchesUrl(sub.href)));

    return (
      /* Anker fuer die Tour, aus dem Pfad abgeleitet: /events wird
         zu nav-events. Kein Sonderfall je Eintrag, und ein neuer
         Navigationspunkt bringt seinen Anker von selbst mit. */
      <div
        key={href}
        className="app-sidebar__group"
        data-tour={`nav-${item.tourId ?? href.replace(/^\//, '').replace(/\//g, '-')}`}
      >
        <Link
          href={(item.search ? `${href}?${item.search}` : href) as never}
          className={cx(
            'app-sidebar__item',
            item.nested && 'app-sidebar__item--nested',
            isActiveBranch && 'app-sidebar__item--active',
          )}
          aria-current={isActiveBranch ? 'page' : undefined}
          /* Eingeklappt ist nur das Symbol zu sehen — Name als Tooltip
             und fuer Screenreader. */
          title={iconOnly ? text : undefined}
          aria-label={iconOnly ? text : undefined}
        >
          {Icon && <Icon className="" />}
          <span className="app-sidebar__item-label">{text}</span>
          {item.badge && !iconOnly && (
            <span className="app-sidebar__item-badge">{item.badge}</span>
          )}
        </Link>
        {!iconOnly && subItems.length > 0 && isActiveBranch && (
          <div className="app-sidebar__subnav">
            {subItems.map((sub) => {
              const isSubActive = matchesUrl(sub.href);
              return (
                <Link
                  key={sub.href}
                  href={sub.href as never}
                  className={cx(
                    'app-sidebar__subitem',
                    isSubActive && 'app-sidebar__subitem--active',
                  )}
                >
                  <span className="app-sidebar__subitem-label">{sub.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <>
        <div className="app-sidebar" style={{ opacity: 0, pointerEvents: 'none' }} />
        <aside className={sidebarClasses}>
          <div className={cx('app-sidebar__logo', isCollapsed && 'app-sidebar__logo--small')}>
            <Logo iconOnly={isCollapsed} height={isCollapsed ? 32 : 44} />
          </div>
          <nav className="app-sidebar__nav">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  height: 36,
                  borderRadius: 8,
                  background: 'color-mix(in oklab, var(--ink) 5%, transparent)',
                  margin: '2px 0',
                  animation: 'none',
                  opacity: 0.5,
                }}
              />
            ))}
          </nav>
        </aside>
      </>
    );
  }

  return (
    <>
      {isMobileOpen && (
        <div
          className="app-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={sidebarClasses}>
        <div className={cx('app-sidebar__logo', isCollapsed && 'app-sidebar__logo--small')}>
          <Logo iconOnly={isCollapsed} height={isCollapsed ? 32 : 44} />
          {/* Frueher unten zwischen Sprache und Thema — dort war er ein
              Werkzeug unter vieren und schwer zu deuten. Oben neben dem
              Logo sitzt er da, wo die Leiste selbst anfaengt. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="app-sidebar__collapse"
            aria-label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            title={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            aria-expanded={!isCollapsed}
          >
            <ChevronLeft />
          </button>
        </div>

        {/* Org block + selector */}
        {!isCollapsed && (
          <div
            className="app-sidebar__org-wrap"
            ref={orgWrapRef}
            data-open={orgMenuOpen ? 'true' : 'false'}
          >
            <button
              type="button"
              className={cx(
                'app-sidebar__org',
                orgMenuNutzbar && 'app-sidebar__org--clickable',
              )}
              onClick={orgMenuNutzbar ? () => setOrgMenuOpen((v) => !v) : undefined}
              aria-expanded={orgMenuNutzbar ? orgMenuOpen : undefined}
              disabled={!orgMenuNutzbar}
            >
              <div className="app-sidebar__org-avatar">
                {orgs.length > 0 ? orgInitial : isSuperAdmin ? 'SA' : '?'}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="app-sidebar__org-name">
                  {orgs.length > 0
                    ? (currentOrganization?.organization?.name ?? t('chooseOrganization'))
                    : isSuperAdmin
                      ? t('superAdmin')
                      : t('noOrganization')}
                </div>
                <div className="app-sidebar__org-role">
                  {orgs.length > 0
                    ? (currentRole ? roleLabel(currentRole) : '')
                    : isSuperAdmin
                      ? t('platformAdministration')
                      : t('createOrganizationHint')}
                </div>
              </div>
              {orgMenuNutzbar && <ChevronDown className="app-sidebar__org-chev" />}
            </button>

            {orgMenuNutzbar && orgMenuOpen && (
              <div className="app-sidebar__org-menu" role="menu">
                {orgs.map((o) => {
                  const initial = o.organization?.name?.[0]?.toUpperCase() ?? 'O';
                  const isCurrent =
                    o.organizationId === currentOrganization?.organizationId;
                  return (
                    <button
                      key={o.organizationId}
                      type="button"
                      role="menuitem"
                      className={cx(
                        'app-sidebar__org-menu-item',
                        isCurrent && 'app-sidebar__org-menu-item--active',
                      )}
                      onClick={() => {
                        setCurrentOrganization(o);
                        setOrgMenuOpen(false);
                      }}
                    >
                      <div className="app-sidebar__org-menu-avatar">{initial}</div>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {o.organization?.name ?? '—'}
                      </span>
                      {isCurrent && <Check className="app-sidebar__org-menu-check" />}
                    </button>
                  );
                })}
                {orgs.length > 0 && (
                  <div
                    style={{
                      height: 1,
                      background: 'color-mix(in oklab, var(--ink) 8%, transparent)',
                      margin: '4px 6px',
                    }}
                  />
                )}
                {deployment.multiTenant && orgLimitReached && (
                  <p
                    data-testid="org-limit-reached"
                    style={{ margin: '4px 10px 6px', fontSize: 11, lineHeight: 1.4, color: 'var(--mute)' }}
                  >
                    {deletionScheduled
                      ? t('organizationCreateDeletionScheduled')
                      : t('organizationLimitReached', { limit: orgSeats.limit })}
                  </p>
                )}
                {deployment.multiTenant && (
                <button
                  type="button"
                  role="menuitem"
                  className="app-sidebar__org-menu-item"
                  disabled={orgLimitReached}
                  aria-disabled={orgLimitReached || undefined}
                  title={
                    deletionScheduled
                      ? t('organizationCreateDeletionScheduled')
                      : orgLimitReached
                        ? t('organizationLimitReached', { limit: orgSeats.limit })
                        : undefined
                  }
                  onClick={() => {
                    if (orgLimitReached) return;
                    setOrgMenuOpen(false);
                    setCreateOrgOpen(true);
                  }}
                  style={{
                    color: 'var(--green-ink)',
                    fontWeight: 600,
                    opacity: orgLimitReached ? 0.5 : undefined,
                    cursor: orgLimitReached ? 'not-allowed' : undefined,
                  }}
                >
                  <div
                    className="app-sidebar__org-menu-avatar"
                    style={{
                      background: 'transparent',
                      color: 'var(--green-ink)',
                      border: '1px dashed color-mix(in oklab, var(--green-ink) 50%, transparent)',
                    }}
                  >
                    <Plus style={{ width: 14, height: 14 }} />
                  </div>
                  <span style={{ flex: 1 }}>{t('newOrganization')}</span>
                </button>
                )}
              </div>
            )}
          </div>
        )}

        <CreateOrgModal open={createOrgOpen} onClose={() => setCreateOrgOpen(false)} />

        {/* Active event indicator */}
        {!isCollapsed && orgIdForEvent && (
          <Link
            href={'/events' as never}
            className="app-sidebar__active-event"
            data-status={activePhase ?? 'none'}
          >
            <Calendar className="app-sidebar__active-event-icon" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="app-sidebar__active-event-label">
                {activeEvent ? activeEvent.name : t('activeEvent.none')}
              </div>
              <div className="app-sidebar__active-event-status">
                {activePhase === 'planned' && activeEvent?.realSalesFrom
                  ? t('activeEvent.plannedFrom', phaseMoment(activeEvent.realSalesFrom, intlLocale))
                  : activePhase === 'active'
                    ? t('activeEvent.active')
                    : activePhase === 'ended'
                      ? t('activeEvent.ended')
                      : activePhase === 'test'
                        ? t('activeEvent.test')
                        : t('activeEvent.activateHint')}
              </div>
            </div>
            {(activePhase === 'test' || activePhase === 'planned') && (
              <span className="app-sidebar__active-event-pill app-sidebar__active-event-pill--test">
                TEST
              </span>
            )}
          </Link>
        )}

        {/* Pending invitations indicator */}
        {!isCollapsed && pendingInvitations.length > 0 && (
          <div
            style={{
              margin: '8px 10px 0',
              padding: '10px 12px',
              borderRadius: 'var(--r)',
              background: 'color-mix(in oklab, var(--warn) 12%, var(--paper-2))',
              border: '1px solid color-mix(in oklab, var(--warn) 25%, transparent)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Mail style={{ width: 15, height: 15, color: 'var(--warn-ink)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--warn-ink)', fontWeight: 600 }}>
              {t('pendingInvitations', { count: pendingInvitations.length })}
            </span>
          </div>
        )}

        {/* Navigation, in Gruppen (src/config/navigation.ts) */}
        <nav className="app-sidebar__nav" data-tour="nav" aria-label={t('navigation')}>
          {navSections.map((section, sectionIndex) => {
            const label = sectionLabel(section);
            const headingId = `app-sidebar-group-${section.id}`;
            const collapsible = isDrawer && !!label;
            const open = !collapsible || !closedGroups.includes(section.id);
            return (
              <div
                key={section.id}
                role={label ? 'group' : undefined}
                aria-label={label ?? undefined}
                className="app-sidebar__section"
                data-section={section.id}
              >
                {/* Eingeklappt bleibt von der Überschrift eine Linie mit
                    Tooltip; ohne Überschrift nur die Linie (nicht vor der
                    ersten Gruppe). */}
                {iconOnly && sectionIndex > 0 && (
                  <div
                    className="app-sidebar__section-sep"
                    role="separator"
                    title={label ?? undefined}
                  />
                )}
                {!iconOnly && label && !collapsible && (
                  <h2 id={headingId} className="app-sidebar__group-label" title={label}>
                    {label}
                  </h2>
                )}
                {!iconOnly && label && collapsible && (
                  <h2 className="app-sidebar__group-label app-sidebar__group-label--toggle">
                    <button
                      type="button"
                      id={headingId}
                      className="app-sidebar__group-toggle"
                      aria-expanded={open}
                      aria-controls={open ? `${headingId}-items` : undefined}
                      title={label}
                      onClick={() => toggleGroup(section.id)}
                    >
                      <span className="app-sidebar__group-toggle-text">{label}</span>
                      <ChevronDown className="app-sidebar__group-chev" aria-hidden="true" />
                    </button>
                  </h2>
                )}
                {!iconOnly && !label && sectionIndex > 0 && (
                  <div className="app-sidebar__section-gap" aria-hidden="true" />
                )}
                {open && (
                  <div id={`${headingId}-items`} className="app-sidebar__section-items">
                    {section.items.map((item) => renderNavItem(item))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer items */}
        <div className="app-sidebar__footer">
          {/* Nur noch eine Zeile: Name mit Menue, daneben der Ausstieg.
              Sprache, Erscheinungsbild und Version sind ins Menue
              gewandert, Support in die Navigation, das Einklappen nach
              oben — vier ungleich breite Symbole nebeneinander ergaben
              keine lesbare Reihe. */}
          {!isCollapsed && (
            <div className="app-sidebar__account">
              <Dropdown
                className="app-sidebar__account-dd"
                placement="top"
                block
                triggerVariant="quiet"
                trigger={
                  <>
                    <span className="oe-avatar oe-avatar--sm oe-avatar--round">
                      {user?.firstName?.[0]?.toUpperCase() ?? '?'}
                    </span>
                    <span className="oe-dd__val">
                      {user?.firstName} {user?.lastName}
                    </span>
                  </>
                }
              >
                {filteredFooterItems.map((item) =>
                  item.href ? (
                    <DropdownLink
                      key={item.href}
                      href={`/${locale}${item.href}${item.search ? `?${item.search}` : ''}`}
                      selected={activeUrl === item.href}
                      icon={item.icon ? <item.icon /> : undefined}
                    >
                      {navLabel(item)}
                    </DropdownLink>
                  ) : null,
                )}

                <DropdownSeparator />
                <DropdownCaption>{t('language')}</DropdownCaption>
                {[
                  { code: 'de', label: 'Deutsch' },
                  { code: 'en', label: 'English' },
                ].map((sprache) => (
                  <DropdownOption
                    key={sprache.code}
                    selected={locale === sprache.code}
                    icon={<Globe />}
                    onClick={() =>
                      localeRouter.replace(localePathname, {
                        locale: sprache.code as 'de' | 'en',
                      })
                    }
                  >
                    {sprache.label}
                  </DropdownOption>
                ))}

                <DropdownSeparator />
                <DropdownCaption>{t('appearance')}</DropdownCaption>
                {(
                  [
                    { wert: 'light', Symbol: Sun },
                    { wert: 'dark', Symbol: Moon },
                    { wert: 'system', Symbol: Monitor },
                  ] as const
                ).map(({ wert, Symbol }) => (
                  <DropdownOption
                    key={wert}
                    selected={themeBereit && theme === wert}
                    icon={<Symbol />}
                    onClick={() => setTheme(wert)}
                  >
                    {tTheme(wert)}
                  </DropdownOption>
                ))}

                <DropdownSeparator />
                <DropdownOption danger icon={<LogOut />} onClick={logout}>
                  {tAuth('logout')}
                </DropdownOption>
              </Dropdown>

              {/* Zweiter Weg neben dem Menueeintrag: im Menue vermutet ihn
                  nicht jeder, und Abmelden ist nichts, wonach man suchen
                  sollte. Dezent, bis der Zeiger darauf steht. */}
              <button
                type="button"
                onClick={logout}
                className="app-sidebar__logout"
                aria-label={tAuth('logout')}
                title={tAuth('logout')}
              >
                <LogOut />
              </button>
            </div>
          )}

          {!isCollapsed && (
            /* "v" nur vor einer echten Versionsnummer — lokal steht hier
               "dev", und "vdev" liest sich wie ein Tippfehler. */
            <p className="app-sidebar__version" title={`Build ${APP_VERSION}`}>
              {/^\d/.test(versionsText) ? `v${versionsText}` : versionsText}
            </p>
          )}
          {!isCollapsed && <SourceCodeLink className="app-sidebar__source" iconSize={12} />}

          {/* Eingeklappt bleibt nur Platz fuer Symbole — dann stehen die
              Eintraege wie zuvor untereinander. */}
          {isCollapsed &&
            filteredFooterItems.map((item) =>
              item.href ? (
                <Link
                  key={item.href}
                  href={(item.search ? `${item.href}?${item.search}` : item.href) as never}
                  className={cx(
                    'app-sidebar__item',
                    activeUrl === item.href && 'app-sidebar__item--active',
                  )}
                  aria-label={navLabel(item)}
                  title={navLabel(item)}
                >
                  {item.icon ? <item.icon /> : null}
                </Link>
              ) : null,
            )}
          {isCollapsed && (
            <button
              onClick={logout}
              className="app-sidebar__item"
              aria-label={tAuth('logout')}
              title={tAuth('logout')}
            >
              <LogOut style={{ width: 18, height: 18, flexShrink: 0, opacity: 0.65 }} />
            </button>
          )}
        </div>
      </aside>


    </>
  );
}
