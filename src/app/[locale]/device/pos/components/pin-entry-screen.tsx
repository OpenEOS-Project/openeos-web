'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon, IconBox, Keypad } from '@openeos/ui';
import { deviceApi } from '@/lib/api-client';
import { textOn } from '@/lib/waiters';
import { ApiException } from '@/types/api';
import type { DeviceWaiterTile, WaiterSessionResponse } from '@/types/waiter';

interface PinEntryScreenProps {
  deviceName: string;
  onSuccess: (session: WaiterSessionResponse) => void;
  onLogout: () => void;
  /** Ohne Verbindung: Entsperren nicht möglich (kein Offline-Betrieb). */
  offline?: boolean;
  /** Warum gesperrt wurde (Hinweis unter dem Titel). */
  lockReason?: 'lock' | 'switch' | 'timeout' | 'expired' | 'revoked' | null;
  /** Nach dem Sperren mit vollem Warenkorb: für wen er gemerkt wurde. */
  parkedFor?: string | null;
  /** Namenskacheln (Kurzname + Farbe), Standard aus. */
  tiles?: boolean;
}

const MAX_PIN_LENGTH = 6;
const MIN_PIN_LENGTH = 4;

/**
 * PIN-Bildschirm „Wer bedient?“ (gemeinsame Kasse): die PIN allein
 * identifiziert die Bedienung bzw. das Mitglied. Nach Fehlversuchen sperrt
 * der Server die Eingabe (30 s, 5 min, bis zur Freigabe).
 */
export function PinEntryScreen({
  deviceName,
  onSuccess,
  onLogout,
  offline = false,
  lockReason = null,
  parkedFor = null,
  tiles = false,
}: PinEntryScreenProps) {
  const t = useTranslations('pos');
  const tCommon = useTranslations('common');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tileList, setTileList] = useState<DeviceWaiterTile[]>([]);
  const [picked, setPicked] = useState<DeviceWaiterTile | null>(null);

  useEffect(() => {
    if (!tiles) return;
    deviceApi
      .getWaiterTiles()
      .then((response) => setTileList(response.data ?? []))
      .catch(() => setTileList([]));
  }, [tiles]);

  useEffect(() => {
    if (!lockedUntil) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        setLockedUntil(null);
        setError(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const locked = lockedUntil !== null && now < lockedUntil;

  const verify = useCallback(
    async (value: string) => {
      if (value.length < MIN_PIN_LENGTH || verifying || locked || offline) return;
      setVerifying(true);
      setError(null);
      try {
        const response = await deviceApi.startWaiterSession(value);
        onSuccess(response.data);
      } catch (caught) {
        const reason = caught instanceof ApiException ? caught.reason : undefined;
        const params = caught instanceof ApiException ? caught.params : undefined;
        if (reason === 'PIN_LOCKED') {
          const seconds = Number(params?.retryAfterSeconds) || 30;
          setLockedUntil(Date.now() + seconds * 1000);
          setNow(Date.now());
          setError(t('pin.locked', { seconds }));
        } else if (reason === 'PIN_DEVICE_LOCKED') {
          setError(t('pin.deviceLocked'));
        } else if (reason === 'WAITER_NOT_FOR_EVENT') {
          setError(t('pin.notForEvent'));
        } else if (
          reason === 'PIN_INVALID' &&
          typeof params?.remainingAttempts === 'number' &&
          params.remainingAttempts <= 2
        ) {
          setError(t('pin.errorRemaining', { count: params.remainingAttempts }));
        } else {
          setError(t('pin.error'));
        }
        setShake(true);
        window.setTimeout(() => setShake(false), 500);
        setPin('');
      } finally {
        setVerifying(false);
      }
    },
    [verifying, locked, offline, onSuccess, t],
  );

  const press = (key: string) => {
    if (locked || offline) return;
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

  const remaining = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const hint = offline
    ? t('pin.offline')
    : parkedFor
      ? t('pin.parked', { name: parkedFor })
      : lockReason === 'timeout'
        ? t('pin.timedOut')
        : lockReason === 'expired' || lockReason === 'revoked'
          ? t('pin.expired')
          : null;

  return (
    <div className="pos-app oe-root pos-pin" data-testid="pos-pin-screen">
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
          <IconBox icon={offline ? 'wifi-off' : 'lock'} tone="accent" size="lg" />
          <h1>{picked ? t('pin.hello', { name: picked.shortName }) : t('pin.whoTitle')}</h1>
          <p>{t('pin.whoDescription')}</p>
          {hint && (
            <p className="pos-pin__hint" role="status">
              {hint}
            </p>
          )}
          {tiles && tileList.length > 0 && (
            <div className="pos-pin__tiles" role="list" aria-label={t('pin.tiles')}>
              {tileList.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  role="listitem"
                  className={picked?.id === tile.id ? 'pos-pin__tile is-on' : 'pos-pin__tile'}
                  style={{ background: tile.color ?? undefined, color: textOn(tile.color) }}
                  onClick={() => setPicked(picked?.id === tile.id ? null : tile)}
                >
                  {tile.shortName}
                </button>
              ))}
            </div>
          )}
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
            disabledKeys={
              verifying || locked || offline
                ? ['enter', 'backspace', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
                : pin.length < MIN_PIN_LENGTH
                  ? ['enter']
                  : []
            }
            labels={{ backspace: t('order.keypadBackspace'), enter: tCommon('confirm') }}
            aria-label={t('pin.whoTitle')}
          />
          {error && (
            <p className="pos-pin__error" role="alert">
              <Icon name="alert" />
              {locked ? t('pin.locked', { seconds: remaining }) : error}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
