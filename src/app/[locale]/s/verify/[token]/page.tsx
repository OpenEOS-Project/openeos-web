'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { CheckCircle, XCircle, Loading02 } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { shiftsPublicApi } from '@/lib/api-client';

type VerificationStatus = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const params = useParams();
  const token = params.token as string;
  const t = useTranslations();

  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [resultData, setResultData] = useState<{
    message: string;
    planSlug: string;
    status: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Ungültiger Verifizierungslink');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await shiftsPublicApi.verifyEmail(token);
        if (response.data) {
          setResultData(response.data);
          setStatus('success');
        } else {
          throw new Error('Unbekannter Fehler');
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten'
        );
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        {/* Loading */}
        {status === 'loading' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-secondary">
              <Loading02 className="h-6 w-6 text-brand-primary animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-primary">
              {t('shifts.verify.loading')}
            </h2>
            <p className="mt-2 text-tertiary">
              {t('shifts.verify.pleaseWait')}
            </p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && resultData && (
          <div className="rounded-xl border border-secondary bg-primary p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
              <CheckCircle className="h-6 w-6 text-success-primary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">
              {t('shifts.verify.successTitle')}
            </h2>
            <p className="mt-2 text-tertiary">
              {resultData.status === 'pending_approval'
                ? t('shifts.verify.pendingApproval')
                : t('shifts.verify.confirmed')}
            </p>

            <div className="mt-6 space-y-3">
              <Link href={`/s/${resultData.planSlug}`}>
                <Button color="secondary" className="w-full">
                  {t('shifts.verify.backToPlan')}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-secondary">
              <XCircle className="h-6 w-6 text-error-primary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">
              {t('shifts.verify.errorTitle')}
            </h2>
            <p className="mt-2 text-tertiary">
              {errorMessage || t('shifts.verify.errorDescription')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
