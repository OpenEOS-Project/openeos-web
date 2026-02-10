'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Building07, Check, X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { authApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

interface InvitationData {
  email: string;
  organizationName: string;
  role: string;
  expiresAt: string;
}

interface InvitationViewProps {
  token: string;
}

export function InvitationView({ token }: InvitationViewProps) {
  const t = useTranslations('invitation');
  const router = useRouter();
  const { user } = useAuthStore();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchInvitation() {
      try {
        const response = await authApi.getInvitationByToken(token);
        setInvitation(response.data);
      } catch (err: any) {
        const code = err?.code || '';
        if (code === 'INVITATION_EXPIRED') {
          setError(t('errors.expired'));
        } else if (code === 'CONFLICT') {
          setError(t('errors.alreadyAccepted'));
        } else {
          setError(t('errors.notFound'));
        }
      } finally {
        setIsLoading(false);
      }
    }
    fetchInvitation();
  }, [token, t]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await authApi.acceptInvitation(token);
      setSuccess(true);
      // Redirect to dashboard after short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'MEMBER_ALREADY_EXISTS') {
        setError(t('errors.alreadyMember'));
      } else if (code === 'FORBIDDEN') {
        setError(t('errors.wrongEmail'));
      } else {
        setError(t('errors.acceptFailed'));
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await authApi.declineInvitation(token);
      router.push('/');
    } catch {
      setError(t('errors.declineFailed'));
    } finally {
      setIsDeclining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-tertiary">{t('loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-error-secondary">
          <X className="size-6 text-error-primary" />
        </div>
        <h1 className="text-lg font-semibold text-primary">{t('errorTitle')}</h1>
        <p className="text-sm text-tertiary">{error}</p>
        <Button color="secondary" onClick={() => router.push('/')}>
          {t('backHome')}
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-secondary">
          <Check className="size-6 text-success-primary" />
        </div>
        <h1 className="text-lg font-semibold text-primary">{t('successTitle')}</h1>
        <p className="text-sm text-tertiary">
          {t('successMessage', { organization: invitation?.organizationName ?? '' })}
        </p>
        <p className="text-xs text-quaternary">{t('redirecting')}</p>
      </div>
    );
  }

  if (!invitation) return null;

  const roleLabel = invitation.role === 'admin' ? t('roles.admin') : t('roles.member');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-secondary">
          <Building07 className="size-6 text-brand-primary" />
        </div>
        <h1 className="text-lg font-semibold text-primary">{t('title')}</h1>
        <p className="mt-1 text-sm text-tertiary">{t('subtitle')}</p>
      </div>

      <div className="rounded-lg border border-secondary bg-secondary p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{invitation.organizationName}</p>
            <p className="text-xs text-tertiary">{t('roleLabel')}: {roleLabel}</p>
          </div>
          <Badge color={invitation.role === 'admin' ? 'purple' : 'blue'}>
            {roleLabel}
          </Badge>
        </div>
      </div>

      {user ? (
        <div className="flex gap-3">
          <Button
            className="flex-1"
            color="secondary"
            onClick={handleDecline}
            isLoading={isDeclining}
            disabled={isAccepting}
          >
            {t('decline')}
          </Button>
          <Button
            className="flex-1"
            color="primary"
            onClick={handleAccept}
            isLoading={isAccepting}
            disabled={isDeclining}
          >
            {t('accept')}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-center text-sm text-tertiary">
            {t('loginToAccept')}
          </p>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              color="secondary"
              href={`/login?redirect=${encodeURIComponent(`/invitations/${token}`)}&email=${encodeURIComponent(invitation.email)}`}
            >
              {t('login')}
            </Button>
            <Button
              className="flex-1"
              color="primary"
              href={`/register?redirect=${encodeURIComponent(`/invitations/${token}`)}&email=${encodeURIComponent(invitation.email)}`}
            >
              {t('register')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
