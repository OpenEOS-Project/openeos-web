'use client';

import { useTranslations } from 'next-intl';
import { Icon, type DataColumn } from '@openeos/ui';

import { useAdminStats, useAdminRevenueStats, useAdminRecentActivity } from '@/hooks/use-admin';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { AdminTable, CellNone, CellText } from '@/components/shared/admin-table';
import type { AdminAuditLog } from '@/types/admin';
import '@/styles/admin-table-wave4.css';

export function SuperAdminDashboard() {
  const t = useTranslations('dashboard.superAdmin');
  const { formatCurrency, formatDateTime } = useLocaleFormat();
  const { data: stats, isLoading: isLoadingStats } = useAdminStats();
  const { data: revenue, isLoading: isLoadingRevenue } = useAdminRevenueStats();
  const { data: auditLogs, isLoading: isLoadingLogs } = useAdminRecentActivity();

  const isLoading = isLoadingStats || isLoadingRevenue;

  const actionLabel = (log: AdminAuditLog) =>
    t.has(`actions.${log.action}` as Parameters<typeof t.has>[0])
      ? t(`actions.${log.action}` as Parameters<typeof t>[0])
      : t('actions.unknown');

  // Nur lesen: Aktion als Titel, auf dem Telefon Person, Organisation und Zeit in Zeile 2.
  const columns: DataColumn<AdminAuditLog>[] = [
    {
      id: 'action',
      header: t('recentActivity.columns.action'),
      mobile: 'title',
      cell: (log) => <CellText title={actionLabel(log)}>{actionLabel(log)}</CellText>,
    },
    {
      id: 'admin',
      header: t('recentActivity.columns.admin'),
      mobile: 'meta',
      className: 'wave4-mono',
      cell: (log) => (log.adminUser ? `${log.adminUser.firstName} ${log.adminUser.lastName}` : <CellNone />),
    },
    {
      id: 'organization',
      header: t('recentActivity.columns.organization'),
      mobile: 'meta',
      cell: (log) =>
        log.organization?.name ? (
          <CellText title={log.organization.name}>{log.organization.name}</CellText>
        ) : (
          <CellNone />
        ),
    },
    {
      id: 'date',
      header: t('recentActivity.columns.date'),
      mobile: 'meta',
      className: 'wave4-date',
      cell: (log) => formatDateTime(log.createdAt),
    },
  ];

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
          <div className="stat-card__value">{isLoading ? '—' : formatCurrency(revenue?.eventRevenue ?? revenue?.totalRevenue ?? 0)}</div>
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
              <Icon name="edit" size={28} />
            </div>
            <h3 className="empty-state__title">{t('recentActivity.empty.title')}</h3>
            <p className="empty-state__sub">{t('recentActivity.empty.description')}</p>
          </div>
        ) : (
          <AdminTable
            caption={t('recentActivity.title')}
            rows={auditLogs}
            rowKey="id"
            columns={columns}
          />
        )}
      </div>
    </div>
  );
}
