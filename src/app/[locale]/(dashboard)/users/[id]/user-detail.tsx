'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { Building } from 'lucide-react';

import { useAdminUpdateUser, useAdminUser, useUnlockUser } from '@/hooks/use-admin';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useDeployment } from '@/components/providers/setup-provider';
import { ListLoading } from '@/components/shared/list-states';
import { DetailPageHead } from '@/components/shared/detail-page-head';
import { toast } from '@/components/shared/toast';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import type { AdminUser } from '@/types/admin';

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
  const deployment = useDeployment();
  const defaultOrganizationLimit = deployment.limits?.organizationsPerUser ?? 5;

  // Datum mit Uhrzeit — "—" fuer fehlende Werte.
  const { formatDateTime: formatDate } = useLocaleFormat();

  if (isLoading) {
    return <ListLoading />;
  }

  if (error || !user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
        <span style={{ fontSize: 14, color: 'var(--red, var(--danger))' }}>{tCommon('error')}</span>
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
      <DetailPageHead backHref="/users" backLabel={t('detail.back')} title={t('detail.title')} />

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
                <Icon name="mail" size={13} />
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
                {unlockUser.isPending ? tCommon('saving') : t('actions.unlock')}
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
            <Building size={16} style={{ color: 'var(--green-ink)' }} />
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
                  <Building size={14} style={{ flexShrink: 0, color: 'var(--ink-faint)' }} />
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

      <OrganizationLimitCard user={user} defaultLimit={defaultOrganizationLimit} />

      {/* Locked Account Card */}
      {isLocked && (
        <div className="app-card" style={{ borderColor: 'color-mix(in oklab, var(--red, var(--danger)) 40%, transparent)' }}>
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid color-mix(in oklab, var(--red, var(--danger)) 20%, transparent)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <Icon name="lock" size={16} style={{ color: 'var(--red, var(--danger))' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--red, var(--danger))', margin: 0 }}>{t('detail.accountLocked')}</h3>
          </div>
          <div style={{ padding: '12px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-faint)', marginBottom: 4 }}>
              <Icon name="calendar" size={13} />
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

/**
 * Eigene Hoechstzahl an Organisationen fuer diesen Benutzer (Support-Fall).
 * Leer = Standard der Installation, 0 = unbegrenzt.
 */
function OrganizationLimitCard({ user, defaultLimit }: { user: AdminUser; defaultLimit: number }) {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const updateUser = useAdminUpdateUser();
  const stored = typeof user.organizationLimit === 'number' ? String(user.organizationLimit) : '';
  const [value, setValue] = useState(stored);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => setValue(stored), [stored]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && !/^\d+$/.test(trimmed)) {
      setFieldError(t('detail.organizationLimitInvalid'));
      return;
    }
    setFieldError(null);
    try {
      await updateUser.mutateAsync({
        userId: user.id,
        data: { organizationLimit: trimmed ? Number(trimmed) : null },
      });
      toast.success(t('detail.organizationLimitSaved'));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <h3 className="app-card__title">{t('detail.organizationLimit')}</h3>
      </div>
      <form onSubmit={onSubmit} style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="auth-field" style={{ maxWidth: 360 }}>
          <span>{t('detail.organizationLimit')}</span>
          <input
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
            className={`input${fieldError ? ' input--error' : ''}`}
            value={value}
            placeholder={t('detail.organizationLimitHint', { limit: defaultLimit })}
            aria-describedby="user-organization-limit-hint"
            onChange={(e) => setValue(e.target.value)}
          />
          <span id="user-organization-limit-hint" style={{ fontSize: 12, color: 'var(--mute)' }}>
            {t('detail.organizationLimitHint', { limit: defaultLimit })}
          </span>
          {fieldError && <span role="alert" className="auth-field__error">{fieldError}</span>}
        </label>
        <div>
          <button type="submit" className="btn btn--primary" disabled={updateUser.isPending || value === stored}>
            {updateUser.isPending ? tCommon('saving') : tCommon('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
