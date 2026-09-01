'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  LogOut01,
  Mail01,
  Plus,
} from '@untitledui/icons';

import { CreateOrgModal } from './create-org-modal';
import { Logo } from '@/components/foundations/logo/logo';
import {
  Dropdown,
  DropdownCaption,
  DropdownLink,
  DropdownOption,
  DropdownSeparator,
} from '@openeos/ui';

import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { ThemeToggle } from '@/components/ui/theme-toggle';

import { Link } from '@/i18n/routing';
import { dashboardFooterItems, dashboardNavItems, superAdminNavItems } from '@/config/navigation';
import { useMyInvitations } from '@/hooks/use-members';
import { useActiveEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import type { NavItemDividerType, NavItemType } from '@/components/app-navigation/config';
import { cx } from '@/utils/cx';
import { APP_VERSION } from '@/lib/version';

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  member: 'Mitglied',
};

export function AppSidebar() {
  const pathname = usePathname();
  useTranslations('sidebar');
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

  const orgIdForEvent = currentOrganization?.organizationId ?? '';
  const { data: activeEvent } = useActiveEvent(orgIdForEvent);

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

  const canSeeNavItem = (item: NavItemType | NavItemDividerType): boolean => {
    if (item.adminOnly) return currentRole === 'admin';
    if (!item.requiredPermission) return true;
    if (currentRole === 'admin') return true;
    return !!currentPermissions?.[item.requiredPermission];
  };

  // Drop dividers that end up leading, trailing, or back-to-back after permission filtering
  const stripOrphanedDividers = (items: (NavItemType | NavItemDividerType)[]) =>
    items.filter((item, index, arr) => {
      if (!item.divider) return true;
      const hasItemBefore = arr.slice(0, index).some((prev) => !prev.divider);
      const hasItemAfter = arr.slice(index + 1).some((next) => !next.divider);
      const nextIsDivider = !!arr[index + 1]?.divider;
      return hasItemBefore && hasItemAfter && !nextIsDivider;
    });

  const navItems = isSuperAdmin
    ? superAdminNavItems
    : stripOrphanedDividers(dashboardNavItems.filter(canSeeNavItem));
  const filteredFooterItems = isSuperAdmin
    ? dashboardFooterItems.filter((item) => !item.adminOnly)
    : dashboardFooterItems.filter(canSeeNavItem);

  /* Support steht als Symbol bei den Werkzeugen, alles Uebrige im Menue
     am Benutzer. Ueber den Pfad ausgewaehlt und nicht ueber die
     Position, damit ein Umsortieren der Navigation das hier nicht
     stillschweigend kaputtmacht. */
  const supportItem = filteredFooterItems.find((item) => item.href === '/support');
  const menuFooterItems = filteredFooterItems.filter((item) => item.href !== '/support');

  const orgs = organizations.filter((o) => o?.organization);
  const hasMultiple = orgs.length > 1;
  const orgInitial = currentOrganization?.organization?.name?.[0]?.toUpperCase() ?? 'O';

  const sidebarClasses = cx(
    'app-sidebar',
    isCollapsed && 'app-sidebar--collapsed',
    isMobileOpen && 'app-sidebar--mobile-open'
  );

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
              className="app-sidebar__org app-sidebar__org--clickable"
              onClick={() => setOrgMenuOpen((v) => !v)}
              aria-expanded={orgMenuOpen}
            >
              <div className="app-sidebar__org-avatar">
                {orgs.length > 0 ? orgInitial : isSuperAdmin ? 'SA' : '?'}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="app-sidebar__org-name">
                  {orgs.length > 0
                    ? (currentOrganization?.organization?.name ?? '— Organisation wählen —')
                    : isSuperAdmin
                      ? 'Super-Admin'
                      : 'Keine Organisation'}
                </div>
                <div className="app-sidebar__org-role">
                  {orgs.length > 0
                    ? (currentRole ? (roleLabels[currentRole] ?? currentRole) : '')
                    : isSuperAdmin
                      ? 'Plattform-Verwaltung'
                      : 'Tippe zum Erstellen'}
                </div>
              </div>
              <ChevronDown className="app-sidebar__org-chev" />
            </button>

            {orgMenuOpen && (
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
                <button
                  type="button"
                  role="menuitem"
                  className="app-sidebar__org-menu-item"
                  onClick={() => {
                    setOrgMenuOpen(false);
                    setCreateOrgOpen(true);
                  }}
                  style={{ color: 'var(--green-ink)', fontWeight: 600 }}
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
                  <span style={{ flex: 1 }}>Neue Organisation</span>
                </button>
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
            data-status={activeEvent?.status ?? 'none'}
          >
            <Calendar className="app-sidebar__active-event-icon" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="app-sidebar__active-event-label">
                {activeEvent ? activeEvent.name : 'Keine aktive Veranstaltung'}
              </div>
              <div className="app-sidebar__active-event-status">
                {activeEvent?.status === 'active'
                  ? 'Aktiv'
                  : activeEvent?.status === 'test'
                    ? 'Test-Modus'
                    : 'Tippe zum Aktivieren'}
              </div>
            </div>
            {activeEvent?.status === 'test' && (
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
              background: 'color-mix(in oklab, #f5b544 12%, var(--paper-2))',
              border: '1px solid color-mix(in oklab, #f5b544 25%, transparent)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Mail01 style={{ width: 15, height: 15, color: '#8a5e10', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#8a5e10', fontWeight: 600 }}>
              {pendingInvitations.length} Einladung{pendingInvitations.length !== 1 ? 'en' : ''} ausstehend
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="app-sidebar__nav">
          {navItems.map((item, index) => {
            if (item.divider) {
              return (
                <div
                  key={`divider-${index}`}
                  aria-hidden="true"
                  style={{
                    height: 1,
                    background: 'color-mix(in oklab, var(--ink) 8%, transparent)',
                    margin: '6px 10px',
                    flexShrink: 0,
                  }}
                />
              );
            }
            if (!item.href) return null;
            const Icon = item.icon;
            const subItems = item.items ?? [];
            const isExactActive = activeUrl === item.href;
            const isActiveBranch =
              isExactActive ||
              activeUrl.startsWith(item.href + '/') ||
              subItems.some((sub) => activeUrl === sub.href || activeUrl.startsWith(sub.href + '/'));

            return (
              <div key={item.href} className="app-sidebar__group">
                <Link
                  href={item.href as never}
                  className={cx(
                    'app-sidebar__item',
                    isActiveBranch && 'app-sidebar__item--active',
                  )}
                >
                  {Icon && <Icon className="" />}
                  <span className="app-sidebar__item-label">{item.label}</span>
                  {item.badge && !isCollapsed && (
                    <span className="app-sidebar__item-badge">{item.badge}</span>
                  )}
                </Link>
                {!isCollapsed && subItems.length > 0 && isActiveBranch && (
                  <div className="app-sidebar__subnav">
                    {subItems.map((sub) => {
                      const isSubActive =
                        activeUrl === sub.href || activeUrl.startsWith(sub.href + '/');
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
          })}
        </nav>

        {/* Footer items */}
        <div className="app-sidebar__footer">
          {/* Vorher sechs Zeilen fuer vier Funktionen: Benutzer,
              Werkzeuge, Support, Einstellungen, Abmelden, Version.
              Einstellungen und Abmelden liegen jetzt im Menue am
              Benutzer, Support als Symbol bei den Werkzeugen. */}
          {!isCollapsed && (
            <div className="app-sidebar__account">
              {/* Dropdown aus dem Designsystem statt eines eigenen
                  Menues: oeffnet nach oben, weil der Fuss der
                  Seitenleiste am unteren Bildschirmrand sitzt. */}
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
                <DropdownCaption>{currentOrganization?.organization?.name}</DropdownCaption>
                {menuFooterItems.map((item) =>
                  item.href ? (
                    <DropdownLink
                      key={item.href}
                      href={`/${locale}${item.href}`}
                      selected={activeUrl === item.href}
                      icon={item.icon ? <item.icon /> : undefined}
                    >
                      {item.label}
                    </DropdownLink>
                  ) : null,
                )}
                <DropdownSeparator />
                <DropdownOption danger icon={<LogOut01 />} onClick={logout}>
                  Abmelden
                </DropdownOption>
              </Dropdown>

              <div className="app-sidebar__account-tools">
                {supportItem?.href && (
                  <Link
                    href={supportItem.href as never}
                    className={cx(
                      'app-sidebar__tool',
                      activeUrl === supportItem.href && 'app-sidebar__tool--active',
                    )}
                    aria-label={supportItem.label}
                    title={supportItem.label}
                  >
                    {supportItem.icon ? <supportItem.icon /> : null}
                  </Link>
                )}
                <LocaleSwitcher />
                <ThemeToggle />
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="app-sidebar__tool app-sidebar__tool--collapse"
                  aria-label="Seitenleiste einklappen"
                  title="Seitenleiste einklappen"
                >
                  <ChevronLeft />
                </button>
              </div>
            </div>
          )}

          {/* Eingeklappt faellt der Konto-Block weg — ohne diesen Knopf
              gaebe es keinen Weg zurueck. Zwei Stellen statt einer mit
              Negativabstand: jede an ihrem natuerlichen Platz. */}
          {isCollapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="app-sidebar__tool app-sidebar__tool--expand"
              aria-label="Seitenleiste ausklappen"
              title="Seitenleiste ausklappen"
            >
              <ChevronLeft />
            </button>
          )}

          {/* Eingeklappt bleibt nur Platz fuer Symbole — dann stehen die
              Eintraege wie zuvor untereinander. */}
          {isCollapsed &&
            filteredFooterItems.map((item) =>
              item.href ? (
                <Link
                  key={item.href}
                  href={item.href as never}
                  className={cx(
                    'app-sidebar__item',
                    activeUrl === item.href && 'app-sidebar__item--active',
                  )}
                  aria-label={item.label}
                  title={item.label}
                >
                  {item.icon ? <item.icon /> : null}
                </Link>
              ) : null,
            )}
          {isCollapsed && (
            <button
              onClick={logout}
              className="app-sidebar__item"
              aria-label="Abmelden"
              title="Abmelden"
            >
              <LogOut01 style={{ width: 18, height: 18, flexShrink: 0, opacity: 0.65 }} />
            </button>
          )}

          {!isCollapsed && (
            /* "v" nur vor einer echten Versionsnummer — lokal steht hier
               "dev", und "vdev" liest sich wie ein Tippfehler. */
            <p className="app-sidebar__version">
              {/^\d/.test(APP_VERSION) ? `v${APP_VERSION}` : APP_VERSION}
            </p>
          )}
        </div>
      </aside>


    </>
  );
}
