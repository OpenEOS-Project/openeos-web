'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Animierte Comic-Bildstrecke auf der linken Hälfte des Admin-Logins.
 *
 * Erzählt den Weg einer Bestellung durchs Festzelt: Kasse → Bon →
 * Läufer → Küche → Zelt. Die Panels liegen als statische Bilder in
 * /public/login-comic; die Bewegung macht CSS (Überblendung + Drift),
 * damit kein Video geladen und kein Autoplay ausgehandelt werden muss.
 */

const PANEL_COUNT = 5;
const INTERVAL_MS = 5200;

/** i18n-Schlüssel je Panel unter auth.login.comic. */
const PANELS = [
  { key: 'checkout', src: '/login-comic/panel-1.webp' },
  { key: 'receipt', src: '/login-comic/panel-2.webp' },
  { key: 'runner', src: '/login-comic/panel-3.webp' },
  { key: 'kitchen', src: '/login-comic/panel-4.webp' },
  { key: 'tent', src: '/login-comic/panel-5.webp' },
] as const;

export function LoginComic() {
  const t = useTranslations('auth.login.comic');
  const [active, setActive] = useState(0);
  /** Pausiert den Automatiklauf, nachdem manuell gewählt wurde. */
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    if (paused) return;

    // Wer Bewegung reduziert haben will, bekommt keinen Selbstlauf:
    // der Wechsel wäre die einzige Bewegung, die dann noch bliebe.
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    timer.current = setInterval(() => {
      setActive((index) => (index + 1) % PANEL_COUNT);
    }, INTERVAL_MS);

    return clear;
  }, [paused, clear]);

  function select(index: number) {
    clear();
    setPaused(true);
    setActive(index);
  }

  return (
    <div className="login-comic">
      <div className="login-comic__stage" aria-hidden>
        {PANELS.map((panel, index) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={panel.key}
            src={panel.src}
            alt=""
            className={`login-comic__panel ${index === active ? 'is-active' : ''}`}
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'low'}
            draggable={false}
          />
        ))}
      </div>

      <div className="login-comic__top">
        <div className="login-comic__logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_dark.png" alt="OpenEOS" />
          <span className="oe-badge oe-badge--ink">{t('badge')}</span>
        </div>
      </div>

      <div className="login-comic__mid">
        <h2 className="login-comic__title">
          {t('headline')}
          <i>{t('headlineAccent')}</i>
        </h2>

        <div className="login-comic__caption" aria-live="polite">
          {/* key erzwingt den Neustart der Einblendanimation. */}
          <div className="login-comic__caption-inner" key={PANELS[active]!.key}>
            <span>{t(`panels.${PANELS[active]!.key}.step`)}</span>
            <p>{t(`panels.${PANELS[active]!.key}.copy`)}</p>
          </div>
        </div>
      </div>

      <div className="login-comic__foot">
        <div className="login-comic__dots" role="tablist" aria-label={t('badge')}>
          {PANELS.map((panel, index) => (
            <button
              key={panel.key}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={t(`panels.${panel.key}.step`)}
              className={`login-comic__dot ${index === active ? 'is-active' : ''}`}
              onClick={() => select(index)}
            />
          ))}
        </div>
        <span className="login-comic__meta">
          <span className="oe-dot oe-dot--live" />
          {t('status')}
        </span>
      </div>
    </div>
  );
}
