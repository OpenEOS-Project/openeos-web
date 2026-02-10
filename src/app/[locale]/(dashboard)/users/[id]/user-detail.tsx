'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Building07,
  Calendar,
  Mail01,
  ShieldTick,
  LockUnlocked01,
  Lock01,
} from '@untitledui/icons';

import { Avatar } from '@/components/ui/avatar/avatar';
import { Badge, BadgeWithIcon } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { useAdminUser, useUnlockUser } from '@/hooks/use-admin';

const ROLE_COLORS: Record<string, 'purple' | 'blue'> = {
  admin: 'purple',
  member: 'blue',
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
      <div className="flex items-center justify-center py-12">
        <div className="text-tertiary">{tCommon('loading')}</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="text-error-primary">{tCommon('error')}</div>
        <Button color="secondary" onClick={() => router.push('/users')}>
          {t('detail.back')}
        </Button>
      </div>
    );
  }

  const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
  const orgs = user.userOrganizations ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Button
          color="tertiary"
          iconLeading={ArrowLeft}
          onClick={() => router.push('/users')}
        />
        <h1 className="text-lg sm:text-display-sm font-semibold text-primary">{t('detail.title')}</h1>
      </div>

      {/* User Info Card */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="p-4 sm:p-6">
          {/* Mobile: stacked layout */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:block">
              <Avatar
                size="lg"
                src={user.avatarUrl || undefined}
                initials={`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}
              />
              {/* Name on mobile next to avatar */}
              <div className="sm:hidden min-w-0">
                <h2 className="text-base font-semibold text-primary truncate">
                  {user.firstName} {user.lastName}
                </h2>
                <div className="flex items-center gap-1 text-sm text-tertiary">
                  <Mail01 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {/* Name on desktop */}
              <div className="hidden sm:block">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold text-primary">
                    {user.firstName} {user.lastName}
                  </h2>
                  {user.isSuperAdmin && (
                    <BadgeWithIcon color="purple" iconLeading={ShieldTick}>
                      {t('role.superAdmin')}
                    </BadgeWithIcon>
                  )}
                  {user.isActive ? (
                    <Badge color="success">{t('status.active')}</Badge>
                  ) : (
                    <Badge color="gray">{t('status.inactive')}</Badge>
                  )}
                  {isLocked && (
                    <Badge color="error">{t('status.locked')}</Badge>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1 text-sm text-tertiary">
                  <Mail01 className="h-4 w-4" />
                  {user.email}
                </div>
              </div>

              {/* Badges on mobile (below name) */}
              <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
                {user.isSuperAdmin && (
                  <BadgeWithIcon color="purple" size="sm" iconLeading={ShieldTick}>
                    {t('role.superAdmin')}
                  </BadgeWithIcon>
                )}
                {user.isActive ? (
                  <Badge color="success" size="sm">{t('status.active')}</Badge>
                ) : (
                  <Badge color="gray" size="sm">{t('status.inactive')}</Badge>
                )}
                {isLocked && (
                  <Badge color="error" size="sm">{t('status.locked')}</Badge>
                )}
              </div>
            </div>

            {/* Unlock button */}
            {isLocked && (
              <Button
                color="secondary"
                size="sm"
                iconLeading={LockUnlocked01}
                onClick={() => unlockUser.mutateAsync(user.id)}
                isLoading={unlockUser.isPending}
                className="w-full sm:w-auto"
              >
                {t('actions.unlock')}
              </Button>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="border-t border-secondary px-4 py-3 sm:px-6 sm:py-4">
          <dl className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-tertiary">{t('detail.registeredAt')}</dt>
              <dd className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-primary">{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-tertiary">{t('table.lastLogin')}</dt>
              <dd className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-primary">{formatDate(user.lastLoginAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-tertiary">{t('detail.emailVerified')}</dt>
              <dd className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-primary">
                {user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : t('detail.notVerified')}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-tertiary">{t('detail.failedLogins')}</dt>
              <dd className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-primary">{user.failedLoginAttempts}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Organizations Card */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <Building07 className="h-5 w-5 text-brand-primary" />
            <h3 className="text-sm sm:text-md font-semibold text-primary">{t('detail.organizations')}</h3>
            <Badge color="gray" size="sm">{orgs.length}</Badge>
          </div>
        </div>

        {orgs.length === 0 ? (
          <div className="px-4 py-6 sm:px-6 sm:py-8 text-center text-sm text-tertiary">
            {t('detail.noOrganizations')}
          </div>
        ) : (
          <div className="divide-y divide-secondary">
            {orgs.map((uo) => (
              <div key={uo.id} className="flex items-center justify-between px-4 py-3 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Building07 className="h-4 w-4 text-tertiary shrink-0" />
                  <span className="text-sm font-medium text-primary truncate">
                    {uo.organization?.name ?? '-'}
                  </span>
                </div>
                <Badge color={ROLE_COLORS[uo.role] ?? 'gray'} size="sm">
                  {tMembers(`roles.${uo.role}` as Parameters<typeof tMembers>[0])}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Card */}
      {isLocked && (
        <div className="rounded-xl border border-error bg-primary shadow-xs">
          <div className="border-b border-error px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2">
              <Lock01 className="h-5 w-5 text-error-primary" />
              <h3 className="text-sm sm:text-md font-semibold text-error-primary">{t('detail.accountLocked')}</h3>
            </div>
          </div>
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2 text-sm text-tertiary">
              <Calendar className="h-4 w-4 shrink-0" />
              {t('detail.lockedUntil', { date: formatDate(user.lockedUntil) })}
            </div>
            <p className="mt-1 text-sm text-tertiary">
              {t('detail.failedAttempts', { count: user.failedLoginAttempts })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
