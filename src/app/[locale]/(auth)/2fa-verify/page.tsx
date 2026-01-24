'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldTick, Mail01, Phone01, RefreshCw01, ArrowLeft } from '@untitledui/icons';
import Link from 'next/link';
import { Button } from '@/components/ui/buttons/button';
import { InputGroup } from '@/components/ui/input/input-group';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import { twoFactorApi, authApi, apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

const verifySchema = z.object({
  code: z.string().length(6, 'Code muss 6 Zeichen haben'),
  trustDevice: z.boolean().optional(),
});

type VerifyFormData = z.infer<typeof verifySchema>;

export default function TwoFactorVerifyPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setOrganizations, setLoading } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<'totp' | 'email' | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Get method from URL params (set during login)
  const twoFactorToken = searchParams.get('token');
  const twoFactorMethod = searchParams.get('method') as 'totp' | 'email' | null;

  useEffect(() => {
    if (twoFactorMethod) {
      setMethod(twoFactorMethod);
    }
  }, [twoFactorMethod]);

  useEffect(() => {
    // Countdown for resend button
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      code: '',
      trustDevice: false,
    },
  });

  const codeValue = watch('code');

  const getDeviceFingerprint = () => {
    // Simple device fingerprint based on browser info
    const data = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join('|');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Detect browser
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';

    return `${browser} on ${os}`;
  };

  const onSubmit = async (data: VerifyFormData) => {
    if (!twoFactorToken) {
      setError('Ungültige Sitzung. Bitte melden Sie sich erneut an.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Store the temp token for the 2FA verify call
      apiClient.setAccessToken(twoFactorToken);

      const response = await twoFactorApi.verify2FA({
        code: data.code,
        trustDevice: data.trustDevice,
        deviceFingerprint: data.trustDevice ? getDeviceFingerprint() : undefined,
        deviceInfo: data.trustDevice ? getDeviceInfo() : undefined,
      });

      const { user, accessToken } = response.data;

      // Set the real access token
      apiClient.setAccessToken(accessToken);

      // Update auth store
      setUser(user);
      setOrganizations(user.userOrganizations || []);
      setLoading(false);

      // Redirect to dashboard
      router.push('/');
    } catch (err) {
      setError(
        isRecoveryMode
          ? 'Ungültiger Wiederherstellungscode'
          : 'Ungültiger Verifizierungscode'
      );
      apiClient.clearAccessToken();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || method !== 'email' || !twoFactorToken) return;

    try {
      apiClient.setAccessToken(twoFactorToken);
      // Re-trigger email OTP by calling setup endpoint
      // Note: This would need a dedicated "resend" endpoint in the backend
      // For now, we'll just set the cooldown
      setResendCooldown(60);
    } catch {
      setError('Code konnte nicht erneut gesendet werden');
    }
  };

  if (!twoFactorToken) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <ShieldTick className="mx-auto h-12 w-12 text-tertiary" />
          <div>
            <h1 className="text-display-sm font-semibold text-primary">Ungültige Sitzung</h1>
            <p className="mt-2 text-tertiary">
              Ihre Sitzung ist abgelaufen oder ungültig. Bitte melden Sie sich erneut an.
            </p>
          </div>
          <Link href="/login">
            <Button className="w-full">Zur Anmeldung</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary_alt">
            {method === 'email' ? (
              <Mail01 className="h-7 w-7 text-brand-primary" />
            ) : (
              <Phone01 className="h-7 w-7 text-brand-primary" />
            )}
          </div>
          <h1 className="mt-6 text-display-sm font-semibold text-primary">
            Zwei-Faktor-Authentifizierung
          </h1>
          <p className="mt-2 text-tertiary">
            {isRecoveryMode
              ? 'Geben Sie einen Ihrer Wiederherstellungscodes ein'
              : method === 'email'
              ? 'Wir haben Ihnen einen Verifizierungscode per E-Mail gesendet'
              : 'Geben Sie den Code aus Ihrer Authenticator-App ein'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-error-secondary p-4 text-sm text-error-primary">
              {error}
            </div>
          )}

          <InputGroup>
            <Label htmlFor="code">
              {isRecoveryMode ? 'Wiederherstellungscode' : 'Verifizierungscode'}
            </Label>
            <Controller
              name="code"
              control={control}
              render={({ field }) => (
                <Input
                  id="code"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder={isRecoveryMode ? 'XXXX-XXXX' : '000000'}
                  maxLength={isRecoveryMode ? 9 : 6}
                  inputClassName="text-center text-2xl tracking-[0.5em] font-mono"
                  autoComplete="one-time-code"
                  autoFocus
                  isInvalid={!!errors.code}
                />
              )}
            />
            {errors.code && (
              <p className="text-sm text-error-primary">{errors.code.message}</p>
            )}
          </InputGroup>

          {!isRecoveryMode && (
            <Controller
              name="trustDevice"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="trustDevice"
                  isSelected={field.value}
                  onChange={field.onChange}
                  label="Diesem Gerät für 30 Tage vertrauen"
                />
              )}
            />
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || codeValue.length < 6}
          >
            {isLoading ? (
              <>
                <RefreshCw01 className="mr-2 h-4 w-4 animate-spin" />
                Verifizieren...
              </>
            ) : (
              'Verifizieren'
            )}
          </Button>

          {/* Resend Code (Email only) */}
          {method === 'email' && !isRecoveryMode && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0}
                className="text-sm text-brand-primary hover:text-brand-primary_hover disabled:text-tertiary disabled:cursor-not-allowed"
              >
                {resendCooldown > 0
                  ? `Code erneut senden (${resendCooldown}s)`
                  : 'Code erneut senden'}
              </button>
            </div>
          )}

          {/* Recovery Code Toggle */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsRecoveryMode(!isRecoveryMode)}
              className="text-sm text-tertiary hover:text-secondary"
            >
              {isRecoveryMode
                ? 'Mit Verifizierungscode anmelden'
                : 'Wiederherstellungscode verwenden'}
            </button>
          </div>
        </form>

        {/* Back to Login */}
        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-tertiary hover:text-secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}
