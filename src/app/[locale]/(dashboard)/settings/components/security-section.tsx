'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShieldTick,
  Phone01,
  Mail01,
  Laptop01,
  Trash01,
  Copy01,
  Check,
  AlertTriangle,
  RefreshCw01,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { InputGroup } from '@/components/ui/input/input-group';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Badge } from '@/components/ui/badges/badges';
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

  // 2FA State
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('select');
  const [totpSetupData, setTotpSetupData] = useState<TotpSetupResult | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesCopied, setCodesCopied] = useState(false);

  // Queries
  const { data: twoFactorStatus, isLoading: is2FALoading } = use2FAStatus();
  const { data: trustedDevices } = useTrustedDevices();
  const { data: sessions } = useSessions();

  // Mutations
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
      // Handle both wrapped and unwrapped response formats
      const data = result?.qrCodeDataUrl ? result : (result as any)?.data;
      setTotpSetupData(data);
      setSetupStep('totp-scan');
    } catch {
      // Error handling
    }
  };

  const handleStartEmailSetup = async () => {
    try {
      await setupEmailOtp.mutateAsync();
      setSetupStep('email-verify');
    } catch {
      // Error handling
    }
  };

  const handleVerifyTotp = async () => {
    try {
      const result = await verifyTotpSetup.mutateAsync(verificationCode);
      // Handle both wrapped and unwrapped response formats
      const codes = result?.recoveryCodes || (result as any)?.data?.recoveryCodes || [];
      setRecoveryCodes(codes);
      setSetupStep('recovery-codes');
      setVerificationCode('');
    } catch {
      // Error handling
    }
  };

  const handleVerifyEmailOtp = async () => {
    try {
      const result = await verifyEmailOtpSetup.mutateAsync(verificationCode);
      // Handle both wrapped and unwrapped response formats
      const codes = result?.recoveryCodes || (result as any)?.data?.recoveryCodes || [];
      setRecoveryCodes(codes);
      setSetupStep('recovery-codes');
      setVerificationCode('');
    } catch {
      // Error handling
    }
  };

  const handleDisable2FA = async () => {
    try {
      await disable2FA.mutateAsync(disablePassword);
      setShowDisableModal(false);
      setDisablePassword('');
    } catch {
      // Error handling
    }
  };

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCodesCopied(true);
    setTimeout(() => setCodesCopied(false), 2000);
  };

  const handleCloseSetupModal = () => {
    setShowSetupModal(false);
    setSetupStep('select');
    setTotpSetupData(null);
    setVerificationCode('');
    setRecoveryCodes([]);
    setCodesCopied(false);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* 2FA Section */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldTick className="h-5 w-5 text-tertiary" />
            <h2 className="text-lg font-semibold text-primary">{t('twoFactor.title')}</h2>
          </div>
          <p className="text-sm text-tertiary mt-1">{t('twoFactor.description')}</p>
        </div>

        <div className="p-6">
          {is2FALoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw01 className="h-6 w-6 animate-spin text-tertiary" />
            </div>
          ) : twoFactorStatus?.enabled ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-secondary">
                    <Check className="h-5 w-5 text-success-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-primary">{t('twoFactor.enabled')}</p>
                    <p className="text-sm text-tertiary">
                      {t('twoFactor.method')}: {' '}
                      {twoFactorStatus.method === 'totp'
                        ? t('twoFactor.methodTotp')
                        : t('twoFactor.methodEmail')}
                    </p>
                  </div>
                </div>
                <Button
                  color="primary-destructive"
                  onClick={() => setShowDisableModal(true)}
                >
                  {t('twoFactor.disable')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-secondary">
                  <AlertTriangle className="h-5 w-5 text-warning-primary" />
                </div>
                <div>
                  <p className="font-medium text-primary">{t('twoFactor.disabled')}</p>
                  <p className="text-sm text-tertiary">{t('twoFactor.description')}</p>
                </div>
              </div>
              <Button onClick={() => setShowSetupModal(true)}>
                {t('twoFactor.enable')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Trusted Devices */}
      {twoFactorStatus?.enabled && (
        <div className="rounded-xl border border-secondary bg-primary shadow-xs">
          <div className="border-b border-secondary px-6 py-4">
            <h3 className="text-lg font-semibold text-primary">{t('trustedDevices.title')}</h3>
            <p className="text-sm text-tertiary mt-1">{t('trustedDevices.description')}</p>
          </div>

          <div className="divide-y divide-secondary">
            {trustedDevices && trustedDevices.length > 0 ? (
              trustedDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Laptop01 className="h-5 w-5 text-tertiary" />
                    <div>
                      <p className="font-medium text-primary">{device.deviceName}</p>
                      <p className="text-sm text-tertiary">
                        {t('trustedDevices.lastUsed')}: {formatDate(device.lastUsedAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    color="tertiary"
                    size="sm"
                    onClick={() => removeTrustedDevice.mutate(device.id)}
                  >
                    <Trash01 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-tertiary">
                {t('trustedDevices.empty')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Sessions */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-primary">{t('sessions.title')}</h3>
            <p className="text-sm text-tertiary mt-1">{t('sessions.description')}</p>
          </div>
          {sessions && sessions.length > 1 && (
            <Button
              color="secondary"
              size="sm"
              onClick={() => revokeAllOtherSessions.mutate()}
              disabled={revokeAllOtherSessions.isPending}
            >
              {t('sessions.revokeAll')}
            </Button>
          )}
        </div>

        <div className="divide-y divide-secondary">
          {sessions?.map((session) => (
            <div key={session.id} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <Laptop01 className="h-5 w-5 text-tertiary" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-primary">{session.deviceInfo}</p>
                    {session.isCurrent && (
                      <Badge size="sm" color="success">{t('sessions.current')}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-tertiary">
                    {session.ipAddress} • {t('sessions.lastActive')}: {formatDate(session.lastActiveAt)}
                  </p>
                </div>
              </div>
              {!session.isCurrent && (
                <Button
                  color="tertiary"
                  size="sm"
                  onClick={() => revokeSession.mutate(session.id)}
                >
                  {t('sessions.revoke')}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2FA Setup Modal */}
      <DialogModal
        isOpen={showSetupModal}
        onClose={handleCloseSetupModal}
        title={t('twoFactor.enable')}
        size="md"
      >
        <div className="p-6 space-y-6">
          {setupStep === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-tertiary">{t('twoFactor.selectMethod')}</p>

              <button
                type="button"
                onClick={handleStartTotpSetup}
                disabled={setupTotp.isPending}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-secondary hover:bg-secondary transition-colors text-left"
              >
                <Phone01 className="h-6 w-6 text-brand-primary" />
                <div>
                  <p className="font-medium text-primary">{t('twoFactor.methodTotp')}</p>
                  <p className="text-sm text-tertiary">{t('twoFactor.setupTotp')}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleStartEmailSetup}
                disabled={setupEmailOtp.isPending}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-secondary hover:bg-secondary transition-colors text-left"
              >
                <Mail01 className="h-6 w-6 text-brand-primary" />
                <div>
                  <p className="font-medium text-primary">{t('twoFactor.methodEmail')}</p>
                  <p className="text-sm text-tertiary">{t('twoFactor.setupEmail')}</p>
                </div>
              </button>
            </div>
          )}

          {setupStep === 'totp-scan' && totpSetupData && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-primary mb-2">{t('twoFactor.scanQrCode')}</h4>
                <p className="text-sm text-tertiary">{t('twoFactor.scanQrCodeDescription')}</p>
              </div>

              <div className="flex justify-center">
                <img
                  src={totpSetupData.qrCodeDataUrl}
                  alt="QR Code"
                  className="w-48 h-48 rounded-lg"
                />
              </div>

              <div>
                <h4 className="font-medium text-primary mb-2">{t('twoFactor.manualEntry')}</h4>
                <p className="text-sm text-tertiary mb-2">{t('twoFactor.manualEntryDescription')}</p>
                <code className="block p-3 bg-secondary rounded-lg text-sm font-mono break-all">
                  {totpSetupData.manualEntryKey}
                </code>
              </div>

              <Button onClick={() => setSetupStep('totp-verify')} className="w-full">
                {t('twoFactor.continue')}
              </Button>
            </div>
          )}

          {setupStep === 'totp-verify' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-primary mb-2">{t('twoFactor.enterCode')}</h4>
                <p className="text-sm text-tertiary">{t('twoFactor.enterCodeDescription')}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="totp-code">Code</Label>
                <Input
                  id="totp-code"
                  value={verificationCode}
                  onChange={(value) => setVerificationCode(value)}
                  placeholder="000000"
                  maxLength={6}
                  inputClassName="text-center text-2xl tracking-widest"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  color="secondary"
                  onClick={() => setSetupStep('totp-scan')}
                  className="flex-1"
                >
                  {t('twoFactor.back')}
                </Button>
                <Button
                  onClick={handleVerifyTotp}
                  disabled={verificationCode.length !== 6 || verifyTotpSetup.isPending}
                  className="flex-1"
                >
                  {verifyTotpSetup.isPending ? t('twoFactor.checking') : t('twoFactor.confirm')}
                </Button>
              </div>
            </div>
          )}

          {setupStep === 'email-verify' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-primary mb-2">{t('twoFactor.enterCode')}</h4>
                <p className="text-sm text-tertiary">{t('twoFactor.emailSent')}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-code">Code</Label>
                <Input
                  id="email-code"
                  value={verificationCode}
                  onChange={(value) => setVerificationCode(value)}
                  placeholder="000000"
                  maxLength={6}
                  inputClassName="text-center text-2xl tracking-widest"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  color="secondary"
                  onClick={() => setSetupStep('select')}
                  className="flex-1"
                >
                  {t('twoFactor.back')}
                </Button>
                <Button
                  onClick={handleVerifyEmailOtp}
                  disabled={verificationCode.length !== 6 || verifyEmailOtpSetup.isPending}
                  className="flex-1"
                >
                  {verifyEmailOtpSetup.isPending ? t('twoFactor.checking') : t('twoFactor.confirm')}
                </Button>
              </div>
            </div>
          )}

          {setupStep === 'recovery-codes' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-primary mb-2">{t('twoFactor.recoveryCodes')}</h4>
                <p className="text-sm text-tertiary">{t('twoFactor.recoveryCodesDescription')}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 bg-secondary rounded-lg">
                {recoveryCodes && recoveryCodes.length > 0 ? (
                  recoveryCodes.map((code, index) => (
                    <code key={index} className="text-sm font-mono text-primary">
                      {code}
                    </code>
                  ))
                ) : (
                  <p className="col-span-2 text-sm text-tertiary">{t('twoFactor.noRecoveryCodes')}</p>
                )}
              </div>

              <Button
                color="secondary"
                onClick={handleCopyRecoveryCodes}
                className="w-full"
              >
                {codesCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {t('twoFactor.recoveryCodesCopied')}
                  </>
                ) : (
                  <>
                    <Copy01 className="h-4 w-4 mr-2" />
                    {t('twoFactor.copyCodes')}
                  </>
                )}
              </Button>

              <Button onClick={handleCloseSetupModal} className="w-full">
                {t('twoFactor.done')}
              </Button>
            </div>
          )}
        </div>
      </DialogModal>

      {/* Disable 2FA Modal */}
      <DialogModal
        isOpen={showDisableModal}
        onClose={() => setShowDisableModal(false)}
        title={t('twoFactor.disableConfirm')}
        size="sm"
      >
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-warning-secondary">
            <AlertTriangle className="h-5 w-5 text-warning-primary shrink-0 mt-0.5" />
            <p className="text-sm text-warning-primary">{t('twoFactor.disableConfirmDescription')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="disable-password">{t('twoFactor.enterPassword')}</Label>
            <Input
              id="disable-password"
              type="password"
              value={disablePassword}
              onChange={(value) => setDisablePassword(value)}
            />
          </div>

          <div className="flex gap-3">
            <Button
              color="secondary"
              onClick={() => setShowDisableModal(false)}
              className="flex-1"
            >
              {t('twoFactor.back')}
            </Button>
            <Button
              color="primary-destructive"
              onClick={handleDisable2FA}
              disabled={!disablePassword || disable2FA.isPending}
              className="flex-1"
            >
              {disable2FA.isPending ? t('twoFactor.disabling') : t('twoFactor.disable')}
            </Button>
          </div>
        </div>
      </DialogModal>
    </div>
  );
}
