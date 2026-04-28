'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Lock01, LogOut01 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Logo } from '@/components/foundations/logo/logo';
import { NumPad } from './num-pad';
import { deviceApi } from '@/lib/api-client';
import { cx } from '@/utils/cx';

interface PinEntryScreenProps {
  deviceName: string;
  onSuccess: (user: { userId: string; firstName: string; lastName: string }) => void;
  onLogout: () => void;
}

const MAX_PIN_LENGTH = 6;
const MIN_PIN_LENGTH = 4;

export function PinEntryScreen({ deviceName, onSuccess, onLogout }: PinEntryScreenProps) {
  const t = useTranslations('pos');
  const tCommon = useTranslations('common');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);

  const handleVerify = useCallback(async (pinValue: string) => {
    if (pinValue.length < MIN_PIN_LENGTH || isVerifying) return;

    setIsVerifying(true);
    setError(null);

    try {
      const response = await deviceApi.verifyPin(pinValue);
      const { userId, firstName, lastName } = response.data;
      onSuccess({ userId, firstName, lastName });
    } catch {
      setError(t('pin.error'));
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  }, [isVerifying, onSuccess, t]);

  const handlePinChange = useCallback((value: string) => {
    setPin(value);
    setError(null);

    // Auto-submit when max length reached
    if (value.length === MAX_PIN_LENGTH) {
      handleVerify(value);
    }
  }, [handleVerify]);

  const handleSubmit = useCallback(() => {
    handleVerify(pin);
  }, [handleVerify, pin]);

  return (
    <div className="flex h-screen flex-col bg-secondary bg-grid">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-secondary bg-primary px-4">
        <div className="flex items-center gap-3">
          <Logo width={100} height={25} />
          <div className="h-5 w-px bg-secondary" />
          <span className="text-sm font-medium text-primary">{deviceName}</span>
        </div>
        <Button color="tertiary" size="sm" onClick={onLogout}>
          <LogOut01 className="h-4 w-4" />
        </Button>
      </header>

      {/* PIN Entry */}
      <div className="flex flex-1 items-start justify-center p-4 pt-8 sm:pt-16">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-secondary bg-primary p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-secondary">
              <Lock01 className="h-7 w-7 text-brand-primary" />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-primary">
              {t('pin.title')}
            </h2>
            <p className="mb-4 text-sm text-tertiary">
              {t('pin.description')}
            </p>

            {/* PIN Dots */}
            <div
              className={cx(
                'mb-4 flex items-center justify-center gap-3 rounded-lg border border-secondary bg-secondary py-4',
                shake && 'animate-shake'
              )}
            >
              {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className={cx(
                    'h-3.5 w-3.5 rounded-full transition-colors',
                    i < pin.length ? 'bg-brand-primary' : 'bg-quaternary'
                  )}
                />
              ))}
            </div>

            {/* NumPad */}
            <NumPad
              value={pin}
              onChange={handlePinChange}
              maxLength={MAX_PIN_LENGTH}
              className="mb-4"
            />

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              className="w-full"
              size="lg"
              disabled={pin.length < MIN_PIN_LENGTH || isVerifying}
              isLoading={isVerifying}
            >
              {isVerifying ? t('pin.verifying') : tCommon('confirm')}
            </Button>

            {/* Error */}
            {error && (
              <p className="mt-3 text-sm text-error-primary">{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
