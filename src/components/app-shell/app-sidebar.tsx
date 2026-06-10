'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut01,
  Mail01,
  Plus,
} from '@untitledui/icons';

import { CreateOrgModal } from './create-org-modal';

import { Link } from '@/i18n/routing';
import { dashboardFooterItems, dashboardNavItems, superAdminNavItems } from '@/config/navigation';
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from '@/hooks/use-members';
import { useActiveEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import type { NavItemType } from '@/components/app-navigation/config';
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

  const { data: pendingInvitations = [], refetch: refetchInvitations } = useMyInvitations();
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();

  const [orgMenuOpen, setOrgMenuOpen] = React.useState(false);
  const [createOrgOpen, setCreateOrgOpen] = React.useState(false);
  const orgWrapRef = React.useRef<HTMLDivElement | null>(null);

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

  const canSeeNavItem = (item: NavItemType): boolean => {
    if (item.adminOnly) return currentRole === 'admin';
    if (!item.requiredPermission) return true;
    if (currentRole === 'admin') return true;
    return !!currentPermissions?.[item.requiredPermission];
  };

  const navItems = isSuperAdmin ? superAdminNavItems : dashboardNavItems.filter(canSeeNavItem);
  const filteredFooterItems = isSuperAdmin
    ? dashboardFooterItems.filter((item) => !item.adminOnly)
    : dashboardFooterItems.filter(canSeeNavItem);

  const handleAcceptInvitation = async (token: string) => {
    try {
      const result = await acceptInvitation.mutateAsync(token);
      if (result.data) {
        setOrganizations([...organizations, result.data]);
        if (organizations.length === 0) setCurrentOrganization(result.data);
      }
      refetchInvitations();
    } catch {
      // silently ignore
    }
  };

  const handleDeclineInvitation = async (token: string) => {
    try {
      await declineInvitation.mutateAsync(token);
      refetchInvitations();
    } catch {
      // silently ignore
    }
  };

  void handleAcceptInvitation;
  void handleDeclineInvitation;

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
          <div className="app-sidebar__logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_dark.png" alt="OpenEOS" />
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
        {/* Logo */}
        <div className="app-sidebar__logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_dark.png" alt="OpenEOS" />
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
                {activeEvent ? activeEvent.name : 'Kein aktives Event'}
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
          {navItems.map((item) => {
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
          {filteredFooterItems.map((item) => {
            const isActive = item.href ? activeUrl === item.href : false;
            const Icon = item.icon;

            if (!item.href) return null;

            return (
              <Link
                key={item.href}
                href={item.href as never}
                className={cx(
                  'app-sidebar__item',
                  isActive && 'app-sidebar__item--active',
                )}
              >
                {Icon && <Icon className="" />}
                <span className="app-sidebar__item-label">{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={logout}
            className="app-sidebar__item"
            style={{ width: '100%', borderTop: 0, borderRight: 0, borderBottom: 0 }}
          >
            <LogOut01 style={{ width: 18, height: 18, flexShrink: 0, opacity: 0.65 }} />
            <span className="app-sidebar__item-label">Abmelden</span>
          </button>

          <button
            onClick={toggleCollapsed}
            className="app-sidebar__collapse-btn"
            aria-label={isCollapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
            style={{ display: 'none' }}
            id="sidebar-collapse-btn"
          >
            {isCollapsed ? (
              <ChevronRight style={{ width: 16, height: 16 }} />
            ) : (
              <ChevronLeft style={{ width: 16, height: 16 }} />
            )}
          </button>

          {!isCollapsed && (
            <p
              style={{
                margin: 0,
                padding: '6px 0 2px',
                textAlign: 'center',
                fontSize: 11,
                color: 'color-mix(in oklab, var(--ink) 40%, transparent)',
              }}
            >
              v{APP_VERSION}
            </p>
          )}
        </div>
      </aside>

      <style>{`
        @media (min-width: 961px) {
          #sidebar-collapse-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
