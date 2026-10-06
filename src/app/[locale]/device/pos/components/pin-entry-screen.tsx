'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon, IconBox, Keypad } from '@openeos/ui';
import { deviceApi } from '@/lib/api-client';
import type { PosSessionUser } from '@/stores/device-store';

interface PinEntryScreenProps {
  deviceName: string;
  onSuccess: (user: PosSessionUser) => void;
  onLogout: () => void;
}

const MAX_PIN_LENGTH = 6;
const MIN_PIN_LENGTH = 4;

/** PIN-Bildschirm: erscheint bei `requirePin` und nach dem Sperren. */
export function PinEntryScreen({ deviceName, onSuccess, onLogout }: PinEntryScreenProps) {
  const t = useTranslations('pos');
  const tCommon = useTranslations('common');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [shake, setShake] = useState(false);

  const verify = useCallback(
    async (value: string) => {
      if (value.length < MIN_PIN_LENGTH || verifying) return;
      setVerifying(true);
      setError(null);
      try {
        const response = await deviceApi.verifyPin(value);
        const { userId, firstName, lastName } = response.data;
        onSuccess({ userId, firstName, lastName });
      } catch {
        setError(t('pin.error'));
        setShake(true);
        window.setTimeout(() => setShake(false), 500);
        setPin('');
      } finally {
        setVerifying(false);
      }
    },
    [verifying, onSuccess, t],
  );

  const press = (key: string) => {
    if (key === 'backspace') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === 'enter') {
      void verify(pin);
      return;
    }
    if (!/^[0-9]$/.test(key) || pin.length >= MAX_PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    setError(null);
    if (next.length === MAX_PIN_LENGTH) void verify(next);
  };

  return (
    <div className="pos-app oe-root pos-pin">
      <header className="pos-head">
        <span className="pos-head__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pos-logo pos-logo--dark" src="/logo_dark.png" alt="OpenEOS" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pos-logo pos-logo--light" src="/logo_light.png" alt="" aria-hidden />
        </span>
        <span className="pos-head__sep" aria-hidden />
        <div className="pos-head__ctx">
          <b>{deviceName}</b>
        </div>
        <span className="pos-head__grow" />
        <Button variant="quiet" iconOnly aria-label={t('logout')} title={t('logout')} onClick={onLogout}>
          <Icon name="logout" />
        </Button>
      </header>

      <main className="pos-pin__main">
        <div className="oe-card pos-pin__card">
          <IconBox icon="lock" tone="accent" size="lg" />
          <h1>{t('pin.title')}</h1>
          <p>{t('pin.description')}</p>
          <div className={shake ? 'pos-pin__dots is-shake' : 'pos-pin__dots'} aria-hidden>
            {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
              <i key={i} className={i < pin.length ? 'is-on' : undefined} />
            ))}
          </div>
          <span className="oe-sr-only" aria-live="polite">
            {pin.length} / {MAX_PIN_LENGTH}
          </span>
          <Keypad
            size="lg"
            onKey={press}
            captureKeyboard
            disabledKeys={verifying ? ['enter', 'backspace'] : pin.length < MIN_PIN_LENGTH ? ['enter'] : []}
            labels={{ backspace: t('order.keypadBackspace'), enter: tCommon('confirm') }}
            aria-label={t('pin.title')}
          />
          {error && (
            <p className="pos-pin__error" role="alert">
              <Icon name="alert" />
              {error}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
