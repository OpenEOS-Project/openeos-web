'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, XCircle, Loading02 } from '@untitledui/icons';

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

  const iconBox = (bg: string, children: React.ReactNode) => (
    <div style={{
      width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1.25rem',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Image src="/logo_dark.png" alt="OpenEOS" width={100} height={28} style={{ height: 28, width: 'auto' }} />
      </header>

      {/* Body */}
      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1rem',
      }}>
        <div className="app-card" style={{ maxWidth: 440, width: '100%' }}>
          <div className="app-card__body" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>

            {/* Loading */}
            {status === 'loading' && (
              <>
                {iconBox(
                  'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                  <Loading02 style={{ width: 28, height: 28, color: 'var(--green-ink)', animation: 'spin 1s linear infinite' }} />
                )}
                <h2 className="section-title" style={{ fontSize: 'clamp(20px,4vw,28px)', marginBottom: 10 }}>
                  {t('shifts.verify.loading')}
                </h2>
                <p style={{ color: 'var(--mute)', fontSize: 15 }}>{t('shifts.verify.pleaseWait')}</p>
              </>
            )}

            {/* Success */}
            {status === 'success' && resultData && (
              <>
                {iconBox(
                  'color-mix(in oklab, var(--green-soft) 70%, transparent)',
                  <CheckCircle style={{ width: 28, height: 28, color: 'var(--green-ink)' }} />
                )}
                <h2 className="section-title" style={{ fontSize: 'clamp(20px,4vw,28px)', marginBottom: 10 }}>
                  {t('shifts.verify.successTitle')}
                </h2>
                <p style={{ color: 'var(--mute)', fontSize: 15, marginBottom: '1.5rem' }}>
                  {resultData.status === 'pending_approval'
                    ? t('shifts.verify.pendingApproval')
                    : t('shifts.verify.confirmed')}
                </p>

                <div style={{ marginTop: 8 }}>
                  <Link href={`/s/${resultData.planSlug}`}>
                    <span className="btn btn--ghost btn--block">{t('shifts.verify.backToPlan')}</span>
                  </Link>
                </div>
              </>
            )}

            {/* Error */}
            {status === 'error' && (
              <>
                {iconBox(
                  'color-mix(in oklab, #d24545 12%, transparent)',
                  <XCircle style={{ width: 28, height: 28, color: '#d24545' }} />
                )}
                <h2 className="section-title" style={{ fontSize: 'clamp(20px,4vw,28px)', marginBottom: 10 }}>
                  {t('shifts.verify.errorTitle')}
                </h2>
                <p style={{ color: 'var(--mute)', fontSize: 15 }}>
                  {errorMessage || t('shifts.verify.errorDescription')}
                </p>
              </>
            )}

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '1.25rem', textAlign: 'center',
        borderTop: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
        fontSize: 13, color: 'var(--mute)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      }}>
        <span>© {new Date().getFullYear()} OpenEOS</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <a href="/impressum" style={{ color: 'inherit' }}>Impressum</a>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
