'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { changelogApi } from '@/lib/api-client';
import { usePreferences, useUpdatePreferences } from '@/hooks/use-user-settings';
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
 * Wer sich zum ersten Mal anmeldet, bekommt es nicht: für ihn ist alles
 * neu und damit nichts eine Neuerung. Sein Stand wird still gesetzt.
 */
export function ChangelogDialog() {
  const t = useTranslations('changelogDialog');
  const locale = useLocale();
  const sprache = locale === 'en' ? 'en' : 'de';

  const { data: preferences } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const [geschlossen, setGeschlossen] = useState(false);

  const zuletztGesehen = preferences?.onboarding?.lastSeenChangelog;

  const { data } = useQuery({
    queryKey: ['changelog', zuletztGesehen ?? 'alle'],
    queryFn: async () => (await changelogApi.list(zuletztGesehen)).data,
    // Erst fragen, wenn der gespeicherte Stand bekannt ist.
    enabled: !!preferences,
    staleTime: 5 * 60 * 1000,
  });

  const neuerdings = useMemo(() => data?.entries ?? [], [data]);
  const neuesterStand = data?.latest ?? null;

  /* Beim ersten Anmelden nur den Stand merken. Ohne das bekäme jeder neue
     Zugang sofort die gesamte Historie vorgesetzt. */
  useEffect(() => {
    if (!preferences || zuletztGesehen || !neuesterStand) return;
    updatePreferences.mutate({ onboarding: { lastSeenChangelog: neuesterStand } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences, zuletztGesehen, neuesterStand]);

  if (geschlossen || !zuletztGesehen || neuerdings.length === 0) return null;

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
              <p className="changelog-dialog__text">{eintrag.text[sprache]}</p>
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
