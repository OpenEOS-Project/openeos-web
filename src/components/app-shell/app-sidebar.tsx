'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ChevronLeft,
  ChevronRight,
  LogOut01,
  Mail01,
  Settings01,
} from '@untitledui/icons';

import { Link } from '@/i18n/routing';
import { dashboardFooterItems, dashboardNavItems, superAdminNavItems } from '@/config/navigation';
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from '@/hooks/use-members';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import type { NavItemType } from '@/components/app-navigation/config';
import { cx } from '@/utils/cx';

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  member: 'Mitglied',
};

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations('sidebar');
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

  const { data: pendingInvitations = [], refetch: refetchInvitations } = useMyInvitations();
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Strip locale prefix for active link matching
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

  const initials = user?.firstName?.[0]?.toUpperCase() ?? '?';
  const orgInitial = currentOrganization?.organization?.name?.[0]?.toUpperCase() ?? 'O';

  const sidebarClasses = cx(
    'app-sidebar',
    isCollapsed && 'app-sidebar--collapsed',
    isMobileOpen && 'app-sidebar--mobile-open'
  );

  if (isLoading) {
    return (
      <>
        {/* Mobile backdrop placeholder */}
        <div className="app-sidebar" style={{ opacity: 0, pointerEvents: 'none' }} />
        {/* Desktop sidebar skeleton */}
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
      {/* Mobile backdrop */}
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

        {/* Org info */}
        {!isCollapsed && currentOrganization?.organization && (
          <div className="app-sidebar__org">
            <div className="app-sidebar__org-avatar">{orgInitial}</div>
            <div style={{ minWidth: 0 }}>
              <div className="app-sidebar__org-name">
                {currentOrganization.organization.name}
              </div>
              {currentRole && (
                <div className="app-sidebar__org-role">{roleLabels[currentRole] ?? currentRole}</div>
              )}
            </div>
          </div>
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
            const isActive = item.href ? activeUrl === item.href || activeUrl.startsWith(item.href + '/') : false;
            const Icon = item.icon;

            if (item.href) {
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={cx(
                    'app-sidebar__item',
                    isActive && 'app-sidebar__item--active'
                  )}
                >
                  {Icon && <Icon className="" />}
                  <span className="app-sidebar__item-label">{item.label}</span>
                  {item.badge && !isCollapsed && (
                    <span className="app-sidebar__item-badge">{item.badge}</span>
                  )}
                </Link>
              );
            }

            return null;
          })}
        </nav>

        {/* Footer items + collapse toggle + user block */}
        <div className="app-sidebar__footer">
          {filteredFooterItems.map((item) => {
            const isActive = item.href ? activeUrl === item.href : false;
            const Icon = item.icon;

            if (!item.href) return null;

            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={cx(
                  'app-sidebar__item',
                  isActive && 'app-sidebar__item--active'
                )}
              >
                {Icon && <Icon className="" />}
                <span className="app-sidebar__item-label">{item.label}</span>
              </Link>
            );
          })}

          {/* Logout item */}
          <button
            onClick={logout}
            className="app-sidebar__item"
            style={{ width: '100%', borderTop: 0, borderRight: 0, borderBottom: 0 }}
          >
            <LogOut01 style={{ width: 18, height: 18, flexShrink: 0, opacity: 0.65 }} />
            <span className="app-sidebar__item-label">Abmelden</span>
          </button>

          {/* Collapse toggle — desktop only */}
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
        </div>
      </aside>

      {/* Desktop collapse button: shown via CSS (hidden on mobile) */}
      <style>{`
        @media (min-width: 961px) {
          #sidebar-collapse-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
