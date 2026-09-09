'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { TOUR_STEPS, TOUR_VERSION, type TourStep } from './tour-steps';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  /** Wird aufgerufen, wenn die Tour beendet oder abgebrochen wird. */
  onFinish: () => void;
}

const PADDING = 6;
const BUBBLE_WIDTH = 320;
const GAP = 12;

function findTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Willkommens-Tour: hebt der Reihe nach echte Elemente hervor.
 *
 * Das Loch im Schleier entsteht über einen sehr weiten Schatten am
 * hervorgehobenen Rechteck, nicht über eine Maske — so bleibt es eine
 * einzige Fläche, die überall gleich abdunkelt, und das Element darunter
 * behält seine eigenen Farben.
 *
 * Schritte, deren Ziel es gerade nicht gibt, werden übersprungen. Das ist
 * kein Randfall: die Navigation richtet sich nach Berechtigungen, und die
 * Quick-Start-Karte verschwindet, sobald die Einrichtung steht — eine
 * Tour, die darauf besteht, zeigte bei der Hälfte der Nutzer auf nichts.
 */
export function WelcomeTour({ onFinish }: Props) {
  const t = useTranslations('onboarding.tour');

  /* Nur Schritte, deren Ziel wirklich im Dokument steht. Einmal beim
     Start ermittelt — währenddessen ändert sich die Seite nicht, und ein
     Neuberechnen bei jedem Schritt könnte die Liste unter dem Nutzer
     umsortieren. */
  const steps = useMemo(
    () => TOUR_STEPS.filter((s) => s.centered || findTarget(s) !== null),
    [],
  );

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = steps[index];

  const messen = useCallback(() => {
    if (!step) return;
    const el = findTarget(step);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setRect(rectOf(el));
  }, [step]);

  useLayoutEffect(() => {
    messen();
  }, [messen]);

  useEffect(() => {
    /* Beim Rollen und bei Größenänderung nachführen, sonst wandert der
       Schleier vom Ziel weg. */
    window.addEventListener('resize', messen);
    window.addEventListener('scroll', messen, true);
    return () => {
      window.removeEventListener('resize', messen);
      window.removeEventListener('scroll', messen, true);
    };
  }, [messen]);

  const weiter = useCallback(() => {
    setIndex((i) => (i + 1 < steps.length ? i + 1 : i));
  }, [steps.length]);

  const zurueck = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
      if (e.key === 'ArrowRight') weiter();
      if (e.key === 'ArrowLeft') zurueck();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFinish, weiter, zurueck]);

  if (!step) return null;

  const letzter = index === steps.length - 1;
  const mittig = !rect;

  /* Die Sprechblase neben das Ziel legen, aber nie über den Rand hinaus. */
  let bubbleStyle: React.CSSProperties;
  if (mittig) {
    bubbleStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  } else {
    const platzRechts = window.innerWidth - (rect.left + rect.width) > BUBBLE_WIDTH + GAP * 2;
    const links = step.placement === 'right' && platzRechts
      ? rect.left + rect.width + GAP
      : Math.min(
          Math.max(GAP, rect.left),
          window.innerWidth - BUBBLE_WIDTH - GAP,
        );
    const untenPlatz = window.innerHeight - (rect.top + rect.height);
    const oben = step.placement === 'right'
      ? Math.max(GAP, Math.min(rect.top, window.innerHeight - 220))
      : untenPlatz > 200
        ? rect.top + rect.height + GAP
        : Math.max(GAP, rect.top - 200 - GAP);
    bubbleStyle = { top: oben, left: links };
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={t('title')}>
      {rect ? (
        <div
          className="tour__spot"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
          }}
        />
      ) : (
        <div className="tour__scrim" />
      )}

      <div className="tour__bubble" style={bubbleStyle}>
        <div className="tour__count">{t('progress', { step: index + 1, total: steps.length })}</div>
        <h2 className="tour__title">{t(`steps.${step.id}.title`)}</h2>
        <p className="tour__text">{t(`steps.${step.id}.text`)}</p>

        <div className="tour__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onFinish}>
            {t('skip')}
          </button>
          <div className="tour__nav">
            {index > 0 && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={zurueck}>
                {t('back')}
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={letzter ? onFinish : weiter}
            >
              {letzter ? t('finish') : t('next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TOUR_VERSION };
