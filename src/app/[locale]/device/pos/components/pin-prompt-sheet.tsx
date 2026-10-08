'use client';

import { useEffect, useState } from 'react';

import { useTranslations } from 'next-intl';

import { Icon, Keypad } from '@openeos/ui';

import { PosSheet } from './pos-sheet';

interface PinPromptSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
  busy: boolean;
  /** Grund der Ablehnung (`PIN_INVALID`, `REFUND_PIN_NOT_AUTHORIZED`). */
  error: string | null;
}

const MAX = 6;
const MIN = 4;

/**
 * PIN für Storno und Erstattung (Geräteeinstellung „Nur mit PIN“): ein
 * Mitglied mit Recht „Bestellungen“ oder ein Admin gibt die Aktion frei.
 */
export function PinPromptSheet({ open, onClose, onSubmit, busy, error }: PinPromptSheetProps) {
  const t = useTranslations('pos.orderHistory.pin');
  const tPos = useTranslations('pos');
  const tCommon = useTranslations('common');
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (open) setPin('');
  }, [open]);
  useEffect(() => {
    if (error) setPin('');
  }, [error]);

  const press = (key: string) => {
    if (busy) return;
    if (key === 'backspace') return setPin((p) => p.slice(0, -1));
    if (key === 'enter') {
      if (pin.length >= MIN) onSubmit(pin);
      return;
    }
    if (!/^[0-9]$/.test(key) || pin.length >= MAX) return;
    setPin(pin + key);
  };

  return (
    <PosSheet
      open={open}
      onClose={onClose}
      size="md"
      icon="lock"
      iconTone="accent"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <div className="pos-oh-pin">
        <p className="pos-hint">{t('description')}</p>
        <div className="pos-pin__dots" aria-hidden>
          {Array.from({ length: MAX }).map((_, i) => (
            <i key={i} className={i < pin.length ? 'is-on' : undefined} />
          ))}
        </div>
        <span className="oe-sr-only" aria-live="polite">
          {pin.length} / {MAX}
        </span>
        {error && (
          <p className="pos-oh-error" role="alert">
            <Icon name="alert" />
            {error === 'REFUND_PIN_NOT_AUTHORIZED' ? t('notAuthorized') : t('invalid')}
          </p>
        )}
        <Keypad
          size="lg"
          onKey={press}
          captureKeyboard
          disabledKeys={busy ? ['enter', 'backspace'] : pin.length < MIN ? ['enter'] : []}
          labels={{ backspace: tPos('order.keypadBackspace'), enter: tCommon('confirm') }}
          aria-label={t('title')}
        />
      </div>
    </PosSheet>
  );
}
