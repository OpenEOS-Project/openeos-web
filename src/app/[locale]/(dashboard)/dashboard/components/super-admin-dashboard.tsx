'use client';

import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { StatsCard, StatsGrid } from '@/components/ui/stats-card/stats-card';
import { useAdminStats, useAdminRevenueStats, useAdminRecentActivity } from '@/hooks/use-admin';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function SuperAdminDashboard() {
  const t = useTranslations('dashboard.superAdmin');
  const { data: stats, isLoading: isLoadingStats } = useAdminStats();
  const { data: revenue, isLoading: isLoadingRevenue } = useAdminRevenueStats();
  const { data: auditLogs, isLoading: isLoadingLogs } = useAdminRecentActivity();

  const isLoading = isLoadingStats || isLoadingRevenue;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Row 1: Main stats */}
      <StatsGrid>
        <StatsCard
          title={t('stats.totalOrganizations')}
          value={isLoading ? '...' : String(stats?.totalOrganizations ?? 0)}
          subtitle={t('stats.totalOrganizationsSubtitle')}
          icon="building"
        />
        <StatsCard
          title={t('stats.totalUsers')}
          value={isLoading ? '...' : String(stats?.totalUsers ?? 0)}
          subtitle={t('stats.totalUsersSubtitle')}
          icon="users"
        />
        <StatsCard
          title={t('stats.totalRevenue')}
          value={isLoading ? '...' : formatCurrency(revenue?.totalRevenue ?? 0)}
          subtitle={t('stats.totalRevenueSubtitle')}
          icon="credit-card"
        />
        <StatsCard
          title={t('stats.activeEvents')}
          value={isLoading ? '...' : String(stats?.activeEvents ?? 0)}
          subtitle={t('stats.activeEventsSubtitle')}
          icon="calendar"
        />
      </StatsGrid>

      {/* Row 2: Secondary stats */}
      <StatsGrid>
        <StatsCard
          title={t('stats.newUsersThisMonth')}
          value={isLoading ? '...' : String(stats?.newUsersThisMonth ?? 0)}
          subtitle={t('stats.newUsersThisMonthSubtitle')}
          icon="users"
        />
        <StatsCard
          title={t('stats.newOrganizationsThisMonth')}
          value={isLoading ? '...' : String(stats?.newOrganizationsThisMonth ?? 0)}
          subtitle={t('stats.newOrganizationsThisMonthSubtitle')}
          icon="building"
        />
        <StatsCard
          title={t('stats.totalCredits')}
          value={isLoading ? '...' : String(stats?.totalCredits ?? 0)}
          subtitle={t('stats.totalCreditsSubtitle')}
          icon="coins"
        />
        <StatsCard
          title={t('stats.pendingPurchases')}
          value={isLoading ? '...' : String(stats?.pendingPurchases ?? 0)}
          subtitle={t('stats.pendingPurchasesSubtitle')}
          icon="shopping-bag"
        />
      </StatsGrid>

      {/* Recent Admin Activity */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-base sm:text-lg font-semibold text-primary">{t('recentActivity.title')}</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-tertiary">{t('recentActivity.subtitle')}</p>
        </div>

        {isLoadingLogs ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-tertiary">Laden...</div>
          </div>
        ) : !auditLogs || auditLogs.length === 0 ? (
          <EmptyState
            icon="settings"
            title={t('recentActivity.empty.title')}
            description={t('recentActivity.empty.description')}
            className="px-4 pb-4 sm:px-6 sm:pb-6"
          />
        ) : (
          <>
            {/* Mobile: Card Layout */}
            <div className="divide-y divide-secondary md:hidden">
              {auditLogs.map((log) => (
                <div key={log.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-primary">
                    {t.has(`actions.${log.action}` as Parameters<typeof t.has>[0])
                      ? t(`actions.${log.action}` as Parameters<typeof t>[0])
                      : t('actions.unknown')}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-tertiary">
                    {log.adminUser && (
                      <span>{log.adminUser.firstName} {log.adminUser.lastName}</span>
                    )}
                    {log.organization?.name && (
                      <span>{log.organization.name}</span>
                    )}
                    <span>{formatDateTime(log.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden md:block overflow-hidden border-t border-secondary">
              <table className="w-full">
                <thead className="bg-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
                      {t('recentActivity.columns.action')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
                      {t('recentActivity.columns.admin')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
                      {t('recentActivity.columns.organization')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
                      {t('recentActivity.columns.date')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary/30">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-primary">
                        {t.has(`actions.${log.action}` as Parameters<typeof t.has>[0])
                          ? t(`actions.${log.action}` as Parameters<typeof t>[0])
                          : t('actions.unknown')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary">
                        {log.adminUser
                          ? `${log.adminUser.firstName} ${log.adminUser.lastName}`
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary">
                        {log.organization?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary">
                        {formatDateTime(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
