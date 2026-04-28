'use client';

import { useTranslations } from 'next-intl';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Row 1: Main stats */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card__label">{t('stats.totalOrganizations')}</div>
          <div className="stat-card__value">{isLoading ? '—' : String(stats?.totalOrganizations ?? 0)}</div>
          <div className="stat-card__sub">{t('stats.totalOrganizationsSubtitle')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">{t('stats.totalUsers')}</div>
          <div className="stat-card__value">{isLoading ? '—' : String(stats?.totalUsers ?? 0)}</div>
          <div className="stat-card__sub">{t('stats.totalUsersSubtitle')}</div>
        </div>
        <div className="stat-card stat-card--accent">
          <div className="stat-card__label">{t('stats.totalRevenue')}</div>
          <div className="stat-card__value">{isLoading ? '—' : formatCurrency(revenue?.totalRevenue ?? 0)}</div>
          <div className="stat-card__sub">{t('stats.totalRevenueSubtitle')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">{t('stats.activeEvents')}</div>
          <div className="stat-card__value">{isLoading ? '—' : String(stats?.activeEvents ?? 0)}</div>
          <div className="stat-card__sub">{t('stats.activeEventsSubtitle')}</div>
        </div>
      </div>

      {/* Row 2: Secondary stats (credits/pendingPurchases removed) */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card__label">{t('stats.newUsersThisMonth')}</div>
          <div className="stat-card__value">{isLoading ? '—' : String(stats?.newUsersThisMonth ?? 0)}</div>
          <div className="stat-card__sub">{t('stats.newUsersThisMonthSubtitle')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">{t('stats.newOrganizationsThisMonth')}</div>
          <div className="stat-card__value">{isLoading ? '—' : String(stats?.newOrganizationsThisMonth ?? 0)}</div>
          <div className="stat-card__sub">{t('stats.newOrganizationsThisMonthSubtitle')}</div>
        </div>
      </div>

      {/* Recent Admin Activity */}
      <div className="app-card app-card--flat">
        <div className="app-card__head">
          <div>
            <h2 className="app-card__title">{t('recentActivity.title')}</h2>
            <p className="app-card__sub">{t('recentActivity.subtitle')}</p>
          </div>
        </div>

        {isLoadingLogs ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '2px solid var(--green-ink)',
                borderTopColor: 'transparent',
                animation: 'spin 0.75s linear infinite',
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : !auditLogs || auditLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </div>
            <h3 className="empty-state__title">{t('recentActivity.empty.title')}</h3>
            <p className="empty-state__sub">{t('recentActivity.empty.description')}</p>
          </div>
        ) : (
          <>
            {/* Mobile: Card Layout */}
            <div
              style={{ borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}
              className="md:hidden"
            >
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {t.has(`actions.${log.action}` as Parameters<typeof t.has>[0])
                      ? t(`actions.${log.action}` as Parameters<typeof t>[0])
                      : t('actions.unknown')}
                  </p>
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 12, color: 'var(--ink-faint)' }}>
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
            <div style={{ overflowX: 'auto' }} className="hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('recentActivity.columns.action')}</th>
                    <th>{t('recentActivity.columns.admin')}</th>
                    <th>{t('recentActivity.columns.organization')}</th>
                    <th>{t('recentActivity.columns.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        {t.has(`actions.${log.action}` as Parameters<typeof t.has>[0])
                          ? t(`actions.${log.action}` as Parameters<typeof t>[0])
                          : t('actions.unknown')}
                      </td>
                      <td className="mono">
                        {log.adminUser
                          ? `${log.adminUser.firstName} ${log.adminUser.lastName}`
                          : '—'}
                      </td>
                      <td>{log.organization?.name ?? '—'}</td>
                      <td className="mono">{formatDateTime(log.createdAt)}</td>
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
