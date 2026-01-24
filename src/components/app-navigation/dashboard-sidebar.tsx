'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ChevronLeft,
  ChevronRight,
  ChevronSelectorVertical,
  LogOut01,
  Mail01,
  Menu02,
  SearchLg,
  X,
} from '@untitledui/icons';

import { Logo } from '@/components/foundations/logo/logo';
import { Avatar } from '@/components/ui/avatar/avatar';
import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { Input } from '@/components/ui/input/input';
import { Tooltip } from '@/components/ui/tooltip/tooltip';
import { dashboardFooterItems, dashboardNavItems, superAdminNavItems } from '@/config/navigation';
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from '@/hooks/use-members';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import type { OrganizationRole } from '@/types/auth';
import { cx } from '@/utils/cx';

import { NavItemBase } from './base-components/nav-item';
import { NavList } from './base-components/nav-list';

const roleLabels: Record<OrganizationRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  cashier: 'Kassierer',
  kitchen: 'Küche',
  delivery: 'Ausgabe',
};

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 72;

export function DashboardSidebar() {
  const pathname = usePathname();
  const t = useTranslations('sidebar');
  const { user, logout, organizations, currentOrganization, setCurrentOrganization, setOrganizations, isLoading } = useAuthStore();
  const { isCollapsed, isFullscreen, isMobileOpen, toggleCollapsed, setMobileOpen } = useSidebarStore();

  // Fetch pending invitations for current user
  const { data: pendingInvitations = [], refetch: refetchInvitations } = useMyInvitations();
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();

  // Remove locale prefix from pathname for comparison
  const activeUrl = pathname.replace(/^\/(de|en)/, '');

  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const navItems = isSuperAdmin ? superAdminNavItems : dashboardNavItems;
  const currentRole = currentOrganization?.role;
  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  // Filter footer items by role (super admins don't see role-restricted items)
  const filteredFooterItems = isSuperAdmin
    ? dashboardFooterItems.filter((item) => !item.roles || item.roles.length === 0)
    : dashboardFooterItems.filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        if (!currentRole) return false;
        return item.roles.includes(currentRole);
      });

  const handleAcceptInvitation = async (token: string) => {
    try {
      const result = await acceptInvitation.mutateAsync(token);
      // Add the new organization to the list
      if (result.data) {
        setOrganizations([...organizations, result.data]);
        // If this is the first organization, set it as current
        if (organizations.length === 0) {
          setCurrentOrganization(result.data);
        }
      }
      refetchInvitations();
    } catch (error) {
      console.error('Failed to accept invitation:', error);
    }
  };

  const handleDeclineInvitation = async (token: string) => {
    try {
      await declineInvitation.mutateAsync(token);
      refetchInvitations();
    } catch (error) {
      console.error('Failed to decline invitation:', error);
    }
  };

  // Show loading skeleton while auth is loading
  if (isLoading) {
    return (
      <>
        {/* Mobile placeholder */}
        <div className="h-14 border-b border-secondary bg-primary lg:hidden" />

        {/* Desktop sidebar skeleton */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex">
          <aside
            style={{ '--width': `${SIDEBAR_WIDTH}px` } as React.CSSProperties}
            className="flex h-full w-(--width) flex-col bg-primary pt-6 border-r border-secondary"
          >
            <div className="flex flex-col gap-5 px-5">
              <Logo height={32} />
              <div className="h-9 animate-pulse rounded-lg bg-secondary" />
            </div>
            <div className="mt-6 flex flex-col gap-1 px-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-secondary" />
              ))}
            </div>
          </aside>
        </div>

        {/* Placeholder for spacing */}
        <div
          style={{ paddingLeft: SIDEBAR_WIDTH }}
          className="invisible hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"
        />
      </>
    );
  }

  // Sidebar content for expanded state
  const sidebarContent = (
    <>
      <div className={cx('flex flex-col gap-5', isCollapsed ? 'px-3' : 'px-4 lg:px-5')}>
        {/* Logo */}
        <div className={cx('flex items-center', isCollapsed ? 'justify-center' : '')}>
          {isCollapsed ? (
            <Logo height={28} iconOnly />
          ) : (
            <Logo height={32} />
          )}
        </div>

        {/* Organization Selector (for non-super-admins with multiple orgs) - hidden when collapsed */}
        {!isCollapsed && !isSuperAdmin && organizations.length > 1 && (
          <Dropdown.Root>
            <Dropdown.Button className="flex w-full items-center justify-between rounded-lg border border-secondary bg-primary p-2 text-left hover:bg-primary_hover">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-primary">
                  {currentOrganization?.organization?.name || 'Organisation wählen'}
                </p>
                <div className="flex items-center gap-2">
                  {currentRole && (
                    <span className="text-xs text-tertiary">{roleLabels[currentRole]}</span>
                  )}
                  {currentOrganization?.organization && (
                    <>
                      <span className="text-xs text-quaternary">•</span>
                      <Tooltip title={t('credits.tooltip')}>
                        <span className="cursor-help text-xs text-tertiary">
                          {currentOrganization.organization.eventCredits} {t('credits.label')}
                        </span>
                      </Tooltip>
                    </>
                  )}
                </div>
              </div>
              <ChevronSelectorVertical className="size-4 text-quaternary" />
            </Dropdown.Button>
            <Dropdown.Popover className="w-full">
              <Dropdown.Menu>
                {organizations.map((org) => (
                  <Dropdown.Item
                    key={org.organizationId}
                    onAction={() => setCurrentOrganization(org)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{org.organization?.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-tertiary">{roleLabels[org.role]}</span>
                        {org.organization && (
                          <>
                            <span className="text-xs text-quaternary">•</span>
                            <span className="text-xs text-tertiary">
                              {org.organization.eventCredits} {t('credits.label')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        )}

        {/* Show current org info for single org users - hidden when collapsed */}
        {!isCollapsed && !isSuperAdmin && organizations.length <= 1 && currentOrganization?.organization && (
          <div className="rounded-lg border border-secondary bg-secondary p-2">
            <p className="truncate text-sm font-medium text-primary">
              {currentOrganization.organization.name}
            </p>
            <div className="flex items-center gap-2">
              {currentRole && (
                <span className="text-xs text-tertiary">{roleLabels[currentRole]}</span>
              )}
              {currentOrganization.organization && (
                <>
                  <span className="text-xs text-quaternary">•</span>
                  <Tooltip title={t('credits.tooltip')}>
                    <span className="cursor-help text-xs text-tertiary">
                      {currentOrganization.organization.eventCredits} {t('credits.label')}
                    </span>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        )}

        {/* Show message and invitations for users without organizations - hidden when collapsed */}
        {!isCollapsed && !isSuperAdmin && organizations.length === 0 && !currentOrganization?.organization && (
          <div className="rounded-lg border border-secondary bg-secondary p-3">
            <p className="text-sm font-medium text-primary">{t('noOrganizations.title')}</p>
            <p className="mt-1 text-xs text-tertiary">{t('noOrganizations.description')}</p>
          </div>
        )}

        {/* Show pending invitations - hidden when collapsed */}
        {!isCollapsed && !isSuperAdmin && pendingInvitations.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Mail01 className="size-4 text-tertiary" />
              <span className="text-xs font-medium text-tertiary">{t('pendingInvitations.title')}</span>
              <Badge size="sm" color="warning">{pendingInvitations.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="rounded-lg border border-secondary bg-primary p-2"
                >
                  <p className="text-sm font-medium text-primary">
                    {invitation.organization?.name}
                  </p>
                  <p className="text-xs text-tertiary">
                    {t('pendingInvitations.asRole', { role: roleLabels[invitation.role] })}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      color="primary"
                      onClick={() => handleAcceptInvitation(invitation.token)}
                      isLoading={acceptInvitation.isPending}
                    >
                      {t('pendingInvitations.accept')}
                    </Button>
                    <Button
                      size="sm"
                      color="tertiary"
                      onClick={() => handleDeclineInvitation(invitation.token)}
                      isLoading={declineInvitation.isPending}
                    >
                      {t('pendingInvitations.decline')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search - hidden when collapsed */}
        {!isCollapsed && (
          <Input shortcut size="sm" aria-label="Suchen" placeholder="Suchen..." icon={SearchLg} />
        )}
      </div>

      <NavList activeUrl={activeUrl} items={navItems} collapsed={isCollapsed} />

      <div className={cx('mt-auto flex flex-col gap-4 py-4', isCollapsed ? 'px-2' : 'px-2 lg:px-4 lg:py-6')}>
        {/* Footer items - icons only when collapsed */}
        {filteredFooterItems.length > 0 && (
          <ul className="flex flex-col">
            {filteredFooterItems.map((item) => (
              <li key={item.label} className="py-0.5">
                <NavItemBase
                  badge={!isCollapsed ? item.badge : undefined}
                  icon={item.icon}
                  href={item.href}
                  type="link"
                  current={item.href === activeUrl}
                  collapsed={isCollapsed}
                >
                  {item.label}
                </NavItemBase>
              </li>
            ))}
          </ul>
        )}

        {/* User Account Card */}
        {isCollapsed ? (
          <Tooltip title={`${user?.firstName} ${user?.lastName}`} placement="right">
            <button
              onClick={logout}
              className="flex items-center justify-center rounded-xl p-2 ring-1 ring-secondary ring-inset hover:bg-primary_hover"
              aria-label="Abmelden"
            >
              <Avatar
                size="sm"
                initials={user?.firstName?.[0]?.toUpperCase()}
                status="online"
              />
            </button>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-secondary ring-inset">
            <Avatar
              size="md"
              initials={user?.firstName?.[0]?.toUpperCase()}
              status="online"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-primary">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-sm text-tertiary">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center justify-center rounded-md p-1.5 text-fg-quaternary transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover"
              aria-label="Abmelden"
            >
              <LogOut01 className="size-4" />
            </button>
          </div>
        )}

        {/* Collapse toggle button - desktop only */}
        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex items-center justify-center rounded-lg border border-secondary bg-primary p-2 text-tertiary hover:bg-primary_hover hover:text-secondary"
          aria-label={isCollapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>
    </>
  );

  // In fullscreen mode, hide sidebar completely on desktop
  if (isFullscreen) {
    return (
      <>
        {/* Mobile header with menu button */}
        <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-secondary bg-primary px-4 lg:hidden">
          <Logo height={24} />
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center rounded-lg p-2 text-fg-secondary hover:bg-primary_hover"
            aria-label="Navigation öffnen"
          >
            <Menu02 className="size-5" />
          </button>
        </header>

        {/* Mobile navigation overlay */}
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-overlay/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-[280px] flex flex-col bg-primary pt-4 shadow-xl">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 flex items-center justify-center rounded-lg p-2 text-fg-secondary hover:bg-primary_hover"
                aria-label="Navigation schließen"
              >
                <X className="size-5" />
              </button>
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Spacer for mobile header */}
        <div className="h-14 lg:hidden" />
      </>
    );
  }

  return (
    <>
      {/* Mobile header with menu button */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-secondary bg-primary px-4 lg:hidden">
        <Logo height={24} />
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center rounded-lg p-2 text-fg-secondary hover:bg-primary_hover"
          aria-label="Navigation öffnen"
        >
          <Menu02 className="size-5" />
        </button>
      </header>

      {/* Mobile navigation overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-overlay/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] flex flex-col bg-primary pt-4 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 flex items-center justify-center rounded-lg p-2 text-fg-secondary hover:bg-primary_hover"
              aria-label="Navigation schließen"
            >
              <X className="size-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <div
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex"
        style={{ width: sidebarWidth }}
      >
        <aside
          className={cx(
            'flex h-full flex-col justify-between overflow-auto bg-primary pt-6 border-r border-secondary transition-all duration-200',
            isCollapsed ? 'w-[72px]' : 'w-[280px]'
          )}
        >
          {sidebarContent}
        </aside>
      </div>

      {/* Spacer for mobile header */}
      <div className="h-14 lg:hidden" />

      {/* Desktop spacer */}
      <div
        style={{ width: sidebarWidth }}
        className="hidden lg:block lg:shrink-0 transition-all duration-200"
      />
    </>
  );
}
