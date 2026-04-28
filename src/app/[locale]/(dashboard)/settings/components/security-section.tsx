'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  use2FAStatus,
  useSetupTotp,
  useVerifyTotpSetup,
  useSetupEmailOtp,
  useVerifyEmailOtpSetup,
  useDisable2FA,
  useTrustedDevices,
  useRemoveTrustedDevice,
  useSessions,
  useRevokeSession,
  useRevokeAllOtherSessions,
} from '@/hooks/use-user-settings';
import type { TotpSetupResult } from '@/types/settings';

type SetupStep = 'select' | 'totp-scan' | 'totp-verify' | 'email-verify' | 'recovery-codes';

export function SecuritySection() {
  const t = useTranslations('settings.security');

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('select');
  const [totpSetupData, setTotpSetupData] = useState<TotpSetupResult | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesCopied, setCodesCopied] = useState(false);

  const { data: twoFactorStatus, isLoading: is2FALoading } = use2FAStatus();
  const { data: trustedDevices } = useTrustedDevices();
  const { data: sessions } = useSessions();

  const setupTotp = useSetupTotp();
  const verifyTotpSetup = useVerifyTotpSetup();
  const setupEmailOtp = useSetupEmailOtp();
  const verifyEmailOtpSetup = useVerifyEmailOtpSetup();
  const disable2FA = useDisable2FA();
  const removeTrustedDevice = useRemoveTrustedDevice();
  const revokeSession = useRevokeSession();
  const revokeAllOtherSessions = useRevokeAllOtherSessions();

  const handleStartTotpSetup = async () => {
    try {
      const result = await setupTotp.mutateAsync();
      const data = result?.qrCodeDataUrl ? result : (result as any)?.data;
      setTotpSetupData(data);
      setSetupStep('totp-scan');
    } catch { /* handled */ }
  };

  const handleStartEmailSetup = async () => {
    try { await setupEmailOtp.mutateAsync(); setSetupStep('email-verify'); } catch { /* handled */ }
  };

  const handleVerifyTotp = async () => {
    try {
      const result = await verifyTotpSetup.mutateAsync(verificationCode);
      const codes = result?.recoveryCodes || (result as any)?.data?.recoveryCodes || [];
      setRecoveryCodes(codes); setSetupStep('recovery-codes'); setVerificationCode('');
    } catch { /* handled */ }
  };

  const handleVerifyEmailOtp = async () => {
    try {
      const result = await verifyEmailOtpSetup.mutateAsync(verificationCode);
      const codes = result?.recoveryCodes || (result as any)?.data?.recoveryCodes || [];
      setRecoveryCodes(codes); setSetupStep('recovery-codes'); setVerificationCode('');
    } catch { /* handled */ }
  };

  const handleDisable2FA = async () => {
    try { await disable2FA.mutateAsync(disablePassword); setShowDisableModal(false); setDisablePassword(''); } catch { /* handled */ }
  };

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCodesCopied(true);
    setTimeout(() => setCodesCopied(false), 2000);
  };

  const handleCloseSetupModal = () => {
    setShowSetupModal(false); setSetupStep('select');
    setTotpSetupData(null); setVerificationCode(''); setRecoveryCodes([]); setCodesCopied(false);
  };

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 2FA */}
      <div className="app-card">
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t('twoFactor.title')}</h2>
          <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('twoFactor.description')}</p>
        </div>

        {is2FALoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : twoFactorStatus?.enabled ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'color-mix(in oklab, #22c55e 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('twoFactor.enabled')}</div>
                <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                  {t('twoFactor.method')}: {twoFactorStatus.method === 'totp' ? t('twoFactor.methodTotp') : t('twoFactor.methodEmail')}
                </div>
              </div>
            </div>
            <button className="btn btn--ghost" style={{ color: 'var(--red, #dc2626)', fontSize: 13 }} onClick={() => setShowDisableModal(true)}>
              {t('twoFactor.disable')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'color-mix(in oklab, #f59e0b 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('twoFactor.disabled')}</div>
                <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('twoFactor.description')}</div>
              </div>
            </div>
            <button className="btn btn--primary" style={{ fontSize: 13 }} onClick={() => setShowSetupModal(true)}>
              {t('twoFactor.enable')}
            </button>
          </div>
        )}
      </div>

      {/* Trusted Devices */}
      {twoFactorStatus?.enabled && (
        <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{t('trustedDevices.title')}</h3>
            <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('trustedDevices.description')}</p>
          </div>
          {trustedDevices && trustedDevices.length > 0 ? (
            trustedDevices.map((device) => (
              <div key={device.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{device.deviceName}</div>
                  <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
                    {t('trustedDevices.lastUsed')}: {formatDate(device.lastUsedAt)}
                  </div>
                </div>
                <button className="btn btn--ghost" style={{ fontSize: 12, color: 'var(--red, #dc2626)' }} onClick={() => removeTrustedDevice.mutate(device.id)}>
                  {t('sessions.revoke')}
                </button>
              </div>
            ))
          ) : (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'color-mix(in oklab, var(--ink) 45%, transparent)', fontSize: 13 }}>
              {t('trustedDevices.empty')}
            </div>
          )}
        </div>
      )}

      {/* Sessions */}
      <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{t('sessions.title')}</h3>
            <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('sessions.description')}</p>
          </div>
          {sessions && sessions.length > 1 && (
            <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => revokeAllOtherSessions.mutate()} disabled={revokeAllOtherSessions.isPending}>
              {t('sessions.revokeAll')}
            </button>
          )}
        </div>
        {sessions?.map((session) => (
          <div key={session.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{session.deviceInfo}</span>
                {session.isCurrent && <span className="badge badge--success" style={{ fontSize: 11 }}>{t('sessions.current')}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
                {session.ipAddress} · {t('sessions.lastActive')}: {formatDate(session.lastActiveAt)}
              </div>
            </div>
            {!session.isCurrent && (
              <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => revokeSession.mutate(session.id)}>
                {t('sessions.revoke')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 2FA Setup Modal */}
      {showSetupModal && (
        <div className="modal__backdrop" onClick={handleCloseSetupModal}>
          <div className="modal__box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div className="modal__title">{t('twoFactor.enable')}</div>
              <button className="modal__close" onClick={handleCloseSetupModal} aria-label="Schließen">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="modal__body">
              {setupStep === 'select' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{t('twoFactor.selectMethod')}</p>
                  <button type="button" onClick={handleStartTotpSetup} disabled={setupTotp.isPending}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 10, border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green-ink)" strokeWidth="1.75"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{t('twoFactor.methodTotp')}</div><div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('twoFactor.setupTotp')}</div></div>
                  </button>
                  <button type="button" onClick={handleStartEmailSetup} disabled={setupEmailOtp.isPending}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 10, border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green-ink)" strokeWidth="1.75"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{t('twoFactor.methodEmail')}</div><div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('twoFactor.setupEmail')}</div></div>
                  </button>
                </div>
              )}

              {setupStep === 'totp-scan' && totpSetupData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div><div style={{ fontWeight: 600, marginBottom: 4 }}>{t('twoFactor.scanQrCode')}</div><p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{t('twoFactor.scanQrCodeDescription')}</p></div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <img src={totpSetupData.qrCodeDataUrl} alt="QR Code" style={{ width: 160, height: 160, borderRadius: 8 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('twoFactor.manualEntry')}</div>
                    <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginBottom: 8 }}>{t('twoFactor.manualEntryDescription')}</p>
                    <code style={{ display: 'block', padding: '10px 12px', background: 'color-mix(in oklab, var(--ink) 6%, transparent)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--f-mono)', wordBreak: 'break-all' }}>{totpSetupData.manualEntryKey}</code>
                  </div>
                  <button className="btn btn--primary btn--block" onClick={() => setSetupStep('totp-verify')}>{t('twoFactor.continue')}</button>
                </div>
              )}

              {setupStep === 'totp-verify' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div><div style={{ fontWeight: 600, marginBottom: 4 }}>{t('twoFactor.enterCode')}</div><p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{t('twoFactor.enterCodeDescription')}</p></div>
                  <div className="auth-field">
                    <label className="auth-field__label">Code</label>
                    <input className="input" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="000000" maxLength={6} style={{ textAlign: 'center', fontSize: 20, letterSpacing: 6 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setSetupStep('totp-scan')}>{t('twoFactor.back')}</button>
                    <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleVerifyTotp} disabled={verificationCode.length !== 6 || verifyTotpSetup.isPending}>
                      {verifyTotpSetup.isPending ? t('twoFactor.checking') : t('twoFactor.confirm')}
                    </button>
                  </div>
                </div>
              )}

              {setupStep === 'email-verify' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div><div style={{ fontWeight: 600, marginBottom: 4 }}>{t('twoFactor.enterCode')}</div><p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{t('twoFactor.emailSent')}</p></div>
                  <div className="auth-field">
                    <label className="auth-field__label">Code</label>
                    <input className="input" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="000000" maxLength={6} style={{ textAlign: 'center', fontSize: 20, letterSpacing: 6 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setSetupStep('select')}>{t('twoFactor.back')}</button>
                    <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleVerifyEmailOtp} disabled={verificationCode.length !== 6 || verifyEmailOtpSetup.isPending}>
                      {verifyEmailOtpSetup.isPending ? t('twoFactor.checking') : t('twoFactor.confirm')}
                    </button>
                  </div>
                </div>
              )}

              {setupStep === 'recovery-codes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div><div style={{ fontWeight: 600, marginBottom: 4 }}>{t('twoFactor.recoveryCodes')}</div><p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{t('twoFactor.recoveryCodesDescription')}</p></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 16, background: 'color-mix(in oklab, var(--ink) 5%, transparent)', borderRadius: 8 }}>
                    {recoveryCodes.length > 0 ? recoveryCodes.map((code, i) => (
                      <code key={i} style={{ fontSize: 12, fontFamily: 'var(--f-mono)' }}>{code}</code>
                    )) : <p style={{ gridColumn: '1/-1', fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('twoFactor.noRecoveryCodes')}</p>}
                  </div>
                  <button className="btn btn--ghost btn--block" onClick={handleCopyRecoveryCodes}>
                    {codesCopied ? t('twoFactor.recoveryCodesCopied') : t('twoFactor.copyCodes')}
                  </button>
                  <button className="btn btn--primary btn--block" onClick={handleCloseSetupModal}>{t('twoFactor.done')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disable 2FA Modal */}
      {showDisableModal && (
        <div className="modal__backdrop" onClick={() => setShowDisableModal(false)}>
          <div className="modal__box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div className="modal__title">{t('twoFactor.disableConfirm')}</div>
              <button className="modal__close" onClick={() => setShowDisableModal(false)} aria-label="Schließen">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, #f59e0b 12%, transparent)', display: 'flex', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <p style={{ fontSize: 13, color: '#92400e' }}>{t('twoFactor.disableConfirmDescription')}</p>
              </div>
              <div className="auth-field">
                <label className="auth-field__label">{t('twoFactor.enterPassword')}</label>
                <input type="password" className="input" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
              </div>
            </div>
            <div className="modal__foot">
              <button className="btn btn--ghost" onClick={() => setShowDisableModal(false)}>{t('twoFactor.back')}</button>
              <button className="btn btn--primary" style={{ background: 'var(--red, #dc2626)' }} onClick={handleDisable2FA} disabled={!disablePassword || disable2FA.isPending}>
                {disable2FA.isPending ? t('twoFactor.disabling') : t('twoFactor.disable')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
