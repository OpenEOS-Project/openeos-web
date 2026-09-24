'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { changelogApi } from '@/lib/api-client';
import { usePreferences, useUpdatePreferences } from '@/hooks/use-user-settings';
import { useAuthStore } from '@/stores/auth-store';
import type { ChangelogArt } from '@/types/changelog';

const ART_KLASSE: Record<ChangelogArt, string> = {
  neu: 'changelog-dialog__tag changelog-dialog__tag--neu',
  verbessert: 'changelog-dialog__tag changelog-dialog__tag--verbessert',
  behoben: 'changelog-dialog__tag changelog-dialog__tag--behoben',
};

/**
 * Was seit dem letzten Besuch dazugekommen ist — einmal beim Anmelden.
 *
 * Gemessen am Datum des neuesten Eintrags, nicht an der Programmversion:
 * die ist die Nummer des Bauauftrags und steigt bei jedem Commit. Daran
 * gekoppelt käme dieses Fenster nach jeder Fehlerkorrektur hoch und hätte
 * nichts zu erzählen.
 *
 * Ohne gespeicherten Stand zählt das Anlegedatum des Kontos. Die erste
 * Fassung hielt jeden ohne Stand für ein neues Konto und setzte ihn
 * still — womit kein einziges bestehendes Konto je etwas zu sehen bekam,
 * denn die hatten alle keinen Stand, weil es das Fenster vorher nicht
 * gab. Ein heute angelegtes Konto sieht damit nichts, eines vom Februar
 * alles seither.
 */
export function ChangelogDialog() {
  const t = useTranslations('changelogDialog');
  const locale = useLocale();
  const sprache = locale === 'en' ? 'en' : 'de';

  const { data: preferences } = usePreferences();
  const { user } = useAuthStore();
  const updatePreferences = useUpdatePreferences();
  const [geschlossen, setGeschlossen] = useState(false);

  const zuletztGesehen = preferences?.onboarding?.lastSeenChangelog;
  /* JJJJ-MM-TT, wie die Einträge selbst — so vergleicht die API beides
     als Zeichenkette. Einträge vom Tag der Registrierung gelten als
     gesehen; wer sich anmeldet, hat den Stand des Tages vor sich. */
  const kontoSeit = user?.createdAt?.slice(0, 10);
  const bezug = zuletztGesehen ?? kontoSeit;

  const { data } = useQuery({
    queryKey: ['changelog', bezug ?? 'alle'],
    queryFn: async () => (await changelogApi.list(bezug)).data,
    // Erst fragen, wenn Stand und Konto bekannt sind.
    enabled: !!preferences && !!bezug,
    staleTime: 5 * 60 * 1000,
  });

  const neuerdings = useMemo(() => data?.entries ?? [], [data]);
  const neuesterStand = data?.latest ?? null;

  /* Gibt es seit dem Bezug nichts Neues, den Stand still merken — sonst
     wird dieselbe Frage bei jedem Seitenaufruf neu gestellt. Gibt es
     etwas, wird der Stand erst beim Schließen gesetzt: was niemand
     gesehen hat, ist nicht gesehen. */
  useEffect(() => {
    if (!preferences || zuletztGesehen || !data || !neuesterStand) return;
    if (neuerdings.length === 0) {
      updatePreferences.mutate({ onboarding: { lastSeenChangelog: neuesterStand } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences, zuletztGesehen, data, neuesterStand, neuerdings.length]);

  if (geschlossen || !data || neuerdings.length === 0) return null;

  const schliessen = () => {
    setGeschlossen(true);
    if (neuesterStand) {
      updatePreferences.mutate({ onboarding: { lastSeenChangelog: neuesterStand } });
    }
  };

  return (
    <div className="changelog-dialog__scrim" role="presentation" onClick={schliessen}>
      <div
        className="changelog-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="changelog-dialog__head">
          <div>
            <h2 id="changelog-dialog-title" className="changelog-dialog__title">
              {t('title')}
            </h2>
            <p className="changelog-dialog__sub">
              {t('subtitle', { count: neuerdings.length })}
            </p>
          </div>
        </div>

        <div className="changelog-dialog__body">
          {neuerdings.map((eintrag) => (
            <article key={`${eintrag.datum}-${eintrag.titel.de}`} className="changelog-dialog__entry">
              <span className={ART_KLASSE[eintrag.art]}>{t(`kinds.${eintrag.art}`)}</span>
              <h3 className="changelog-dialog__entry-title">{eintrag.titel[sprache]}</h3>
              {/* Kurzfassung, wenn es eine gibt: Das Fenster soll einen
                  Überblick geben. Wer mehr wissen will, findet den vollen
                  Text auf der Website. */}
              <p className="changelog-dialog__text">
                {(eintrag.kurz ?? eintrag.text)[sprache]}
              </p>
            </article>
          ))}
        </div>

        <div className="changelog-dialog__foot">
          <button type="button" className="btn btn--primary" onClick={schliessen}>
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
