'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useAdminUsers, useUnlockUser } from '@/hooks/use-admin';
import type { AdminUser } from '@/types/admin';

export function UsersList() {
  const t = useTranslations('users');
  const tMembers = useTranslations('members');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { data, isLoading, error } = useAdminUsers();
  const unlockUser = useUnlockUser();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <span style={{ fontSize: 14, color: 'var(--ink-faint)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
        <span style={{ fontSize: 14, color: 'var(--red, #dc2626)' }}>{tCommon('error')}</span>
        <button type="button" className="btn btn--ghost" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  const users = data?.data ?? [];

  if (users.length === 0) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('empty.title')}</h3>
          <p className="empty-state__sub">{t('empty.description')}</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUserStatus = (user: AdminUser) => {
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return 'locked';
    if (!user.isActive) return 'inactive';
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="badge badge--success">{t('status.active')}</span>;
      case 'inactive': return <span className="badge badge--neutral">{t('status.inactive')}</span>;
      case 'locked': return <span className="badge badge--error">{t('status.locked')}</span>;
      default: return null;
    }
  };

  const handleUnlock = async (userId: string) => {
    try {
      await unlockUser.mutateAsync(userId);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <>
      {/* Mobile card list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="md:hidden">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>{t('title')}</h2>
          <span className="badge badge--neutral">{users.length}</span>
        </div>
        {users.map((user) => {
          const status = getUserStatus(user);
          const orgs = user.userOrganizations ?? [];
          return (
            <button
              key={user.id}
              type="button"
              onClick={() => router.push(`/users/${user.id}`)}
              className="app-card"
              style={{ textAlign: 'left', cursor: 'pointer', padding: 14 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                  color: 'var(--green-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'var(--f-mono)',
                  flexShrink: 0,
                }}>
                  {(user.firstName?.[0] || '').toUpperCase()}{(user.lastName?.[0] || '').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.firstName} {user.lastName}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--ink-faint)' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: '2px 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {getStatusBadge(status)}
                    {user.isSuperAdmin ? (
                      <span className="badge badge--info">{t('role.superAdmin')}</span>
                    ) : orgs.length > 0 ? (
                      orgs.map((uo) => (
                        <span key={uo.id} className={`badge ${uo.role === 'admin' ? 'badge--info' : 'badge--neutral'}`}>
                          {tMembers(`roles.${uo.role}` as Parameters<typeof tMembers>[0])}
                        </span>
                      ))
                    ) : null}
                  </div>
                  {orgs.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {orgs.map((uo) => (
                        <span key={uo.id} style={{ fontSize: 11, color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
                          </svg>
                          {uo.organization?.name ?? '-'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="app-card app-card--flat hidden md:block">
        <div className="app-card__head">
          <div>
            <h2 className="app-card__title">
              {t('title')}
              <span className="pill" style={{ marginLeft: 8 }}>{users.length}</span>
            </h2>
            <p className="app-card__sub">{t('subtitle')}</p>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.name')}</th>
                <th>{t('table.email')}</th>
                <th>{t('table.status')}</th>
                <th>{t('table.role')}</th>
                <th>{t('table.organizations')}</th>
                <th>{t('table.lastLogin')}</th>
                <th>{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const status = getUserStatus(user);
                const orgs = user.userOrganizations ?? [];
                return (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                          color: 'var(--green-ink)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: 'var(--f-mono)',
                          flexShrink: 0,
                        }}>
                          {(user.firstName?.[0] || '').toUpperCase()}{(user.lastName?.[0] || '').toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{user.firstName} {user.lastName}</span>
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{user.email}</td>
                    <td>{getStatusBadge(status)}</td>
                    <td>
                      {user.isSuperAdmin ? (
                        <span className="badge badge--info">{t('role.superAdmin')}</span>
                      ) : orgs.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {orgs.map((uo) => (
                            <span key={uo.id} className={`badge ${uo.role === 'admin' ? 'badge--info' : 'badge--neutral'}`}>
                              {tMembers(`roles.${uo.role}` as Parameters<typeof tMembers>[0])}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="badge badge--neutral">{t('role.user')}</span>
                      )}
                    </td>
                    <td>
                      {orgs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {orgs.map((uo) => (
                            <span key={uo.id} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-faint)' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
                              </svg>
                              {uo.organization?.name ?? '-'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>-</span>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{formatDate(user.lastLoginAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => router.push(`/users/${user.id}`)}
                        >
                          {t('actions.view')}
                        </button>
                        {status === 'locked' && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => handleUnlock(user.id)}
                            disabled={unlockUser.isPending}
                          >
                            {t('actions.unlock')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
