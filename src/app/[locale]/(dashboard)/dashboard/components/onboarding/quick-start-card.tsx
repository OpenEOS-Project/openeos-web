'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useOnboardingStatus } from '@/hooks/use-onboarding';
import { usePreferences, useUpdatePreferences } from '@/hooks/use-user-settings';
import type { OnboardingStepId } from '@/types/onboarding';

interface Props {
  organizationId: string;
}

/** Wohin ein Schritt führt. Die Ziele sind bestehende Seiten — der
 *  Quick-Start baut keine eigenen Formulare nach. */
const ZIELE: Record<OnboardingStepId, string> = {
  event: '/events',
  activate: '/events',
  categories: '/products',
  products: '/products',
  device: '/devices',
};

/**
 * Quick-Start: die Ersteinrichtung als Checkliste.
 *
 * Bewusst keine eigenen Formulare. Jeder Schritt führt auf die Seite, auf
 * der die Sache ohnehin angelegt wird — ein nachgebauter Ablauf hätte
 * dieselben Dialoge ein zweites Mal, und zwei Fassungen desselben
 * Formulars laufen auseinander.
 *
 * Der Fortschritt kommt vom Server aus den echten Daten. Wer sein
 * einziges Produkt wieder löscht, verliert den Haken auch wieder — was
 * richtig ist, denn dann ist der Schritt eben nicht erledigt.
 */
export function QuickStartCard({ organizationId }: Props) {
  const t = useTranslations('onboarding.quickStart');
  const router = useRouter();

  const { data: status, isLoading } = useOnboardingStatus(organizationId);
  const { data: preferences } = usePreferences();
  const updatePreferences = useUpdatePreferences();

  const versteckt = preferences?.onboarding?.quickStartHidden === true;
  const fertig = !!status && status.completed === status.total;

  /* Weg, sobald alles erledigt ist — oder wenn der Nutzer sie wegklickt.
     Eine Karte, die nach getaner Arbeit stehen bleibt, wird zur Deko. */
  if (isLoading || !status || versteckt || fertig) return null;

  const anteil = Math.round((status.completed / status.total) * 100);

  return (
    <div className="app-card quick-start" data-tour="quick-start">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('title')}</h2>
          <p className="app-card__sub">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() =>
            updatePreferences.mutate({ onboarding: { quickStartHidden: true } })
          }
        >
          {t('hide')}
        </button>
      </div>

      <div className="quick-start__body">
        <div className="quick-start__progress">
          <div
            className="quick-start__bar"
            role="progressbar"
            aria-valuenow={status.completed}
            aria-valuemin={0}
            aria-valuemax={status.total}
            aria-label={t('title')}
          >
            <i style={{ width: `${anteil}%` }} />
          </div>
          <span className="quick-start__count">
            {t('progress', { done: status.completed, total: status.total })}
          </span>
        </div>

        <ol className="quick-start__steps">
          {status.steps.map((step, index) => (
            <li
              key={step.id}
              className={`quick-start__step${step.done ? ' is-done' : ''}`}
            >
              <span className="quick-start__marker" aria-hidden="true">
                {step.done ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>

              <span className="quick-start__copy">
                <span className="quick-start__label">{t(`steps.${step.id}.label`)}</span>
                <span className="quick-start__hint">{t(`steps.${step.id}.hint`)}</span>
              </span>

              {step.done ? (
                <span className="quick-start__done">{t('done', { count: step.count })}</span>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => router.push(ZIELE[step.id])}
                >
                  {t('go')}
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
