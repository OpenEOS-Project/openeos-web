'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useAdminUser, useUnlockUser } from '@/hooks/use-admin';

const ROLE_BADGE: Record<string, string> = {
  admin: 'badge--info',
  member: 'badge--neutral',
};

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('users');
  const tMembers = useTranslations('members');
  const tCommon = useTranslations('common');
  const { data: user, isLoading, error } = useAdminUser(id);
  const unlockUser = useUnlockUser();

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <span style={{ fontSize: 14, color: 'var(--ink-faint)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
        <span style={{ fontSize: 14, color: 'var(--red, #dc2626)' }}>{tCommon('error')}</span>
        <button type="button" className="btn btn--ghost" onClick={() => router.push('/users')}>
          {t('detail.back')}
        </button>
      </div>
    );
  }

  const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
  const orgs = user.userOrganizations ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="app-page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ padding: '6px 10px', minWidth: 0 }}
            onClick={() => router.push('/users')}
            aria-label="Back"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="section-title">{t('detail.title')}</h1>
        </div>
      </div>

      {/* User Info Card */}
      <div className="app-card">
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
              color: 'var(--green-ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              fontFamily: 'var(--f-mono)',
              flexShrink: 0,
            }}>
              {(user.firstName?.[0] || '').toUpperCase()}{(user.lastName?.[0] || '').toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  {user.firstName} {user.lastName}
                </h2>
                {user.isSuperAdmin && (
                  <span className="badge badge--info">{t('role.superAdmin')}</span>
                )}
                {user.isActive ? (
                  <span className="badge badge--success">{t('status.active')}</span>
                ) : (
                  <span className="badge badge--neutral">{t('status.inactive')}</span>
                )}
                {isLocked && (
                  <span className="badge badge--error">{t('status.locked')}</span>
                )}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                </svg>
                {user.email}
              </div>
            </div>

            {isLocked && (
              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: 13 }}
                onClick={() => unlockUser.mutateAsync(user.id)}
                disabled={unlockUser.isPending}
              >
                {unlockUser.isPending ? '...' : t('actions.unlock')}
              </button>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div style={{
          borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
          padding: '14px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {t('detail.registeredAt')}
            </div>
            <div className="mono" style={{ fontSize: 13 }}>{formatDate(user.createdAt)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {t('table.lastLogin')}
            </div>
            <div className="mono" style={{ fontSize: 13 }}>{formatDate(user.lastLoginAt)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {t('detail.emailVerified')}
            </div>
            <div className="mono" style={{ fontSize: 13 }}>
              {user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : t('detail.notVerified')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {t('detail.failedLogins')}
            </div>
            <div className="mono" style={{ fontSize: 13 }}>{user.failedLoginAttempts}</div>
          </div>
        </div>
      </div>

      {/* Organizations Card */}
      <div className="app-card app-card--flat">
        <div className="app-card__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green-ink)" strokeWidth="2">
              <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
            </svg>
            <h3 className="app-card__title">
              {t('detail.organizations')}
              <span className="pill" style={{ marginLeft: 8 }}>{orgs.length}</span>
            </h3>
          </div>
        </div>

        {orgs.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 24px' }}>
            <p className="empty-state__sub">{t('detail.noOrganizations')}</p>
          </div>
        ) : (
          <div style={{ borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
            {orgs.map((uo) => (
              <div
                key={uo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--ink-faint)' }}>
                    <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {uo.organization?.name ?? '-'}
                  </span>
                </div>
                <span className={`badge ${ROLE_BADGE[uo.role] ?? 'badge--neutral'}`}>
                  {tMembers(`roles.${uo.role}` as Parameters<typeof tMembers>[0])}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Locked Account Card */}
      {isLocked && (
        <div className="app-card" style={{ borderColor: 'color-mix(in oklab, var(--red, #dc2626) 40%, transparent)' }}>
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid color-mix(in oklab, var(--red, #dc2626) 20%, transparent)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red, #dc2626)" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--red, #dc2626)', margin: 0 }}>{t('detail.accountLocked')}</h3>
          </div>
          <div style={{ padding: '12px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-faint)', marginBottom: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {t('detail.lockedUntil', { date: formatDate(user.lockedUntil) })}
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: 0 }}>
              {t('detail.failedAttempts', { count: user.failedLoginAttempts })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
