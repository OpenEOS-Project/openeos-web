'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Check, Mail01 } from '@untitledui/icons';

import { adminApi } from '@/lib/api-client';
import { ApiException } from '@/types/api';
import type { ContactRequestKind } from '@/types/contact';

/** Reihenfolge der Filter: was am häufigsten gesucht wird, steht vorn. */
const FILTER: (ContactRequestKind | 'alle')[] = [
  'alle',
  'feature',
  'feedback',
  'demo',
  'contact',
  'hardware',
  'gateway',
];

export function FeedbackContainer() {
  const t = useTranslations('admin.feedback');
  const queryClient = useQueryClient();
  const [art, setArt] = useState<(typeof FILTER)[number]>('alle');
  const [nurOffene, setNurOffene] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-contact-requests', art, nurOffene],
    queryFn: () =>
      adminApi.listContactRequests({
        type: art === 'alle' ? undefined : art,
        handled: nurOffene ? false : undefined,
      }),
    /* Fehlende Berechtigung wird durch Wiederholen nicht besser — ohne
       diese Ausnahme schickt die Seite viermal dieselbe abgelehnte
       Anfrage hinterher. */
    retry: (versuche, fehler) =>
      !(fehler instanceof ApiException && fehler.status === 403) && versuche < 2,
  });

  const abhaken = useMutation({
    mutationFn: (id: string) => adminApi.toggleContactRequestHandled(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contact-requests'] });
    },
  });

  const eintraege = data?.data ?? [];
  /* Ein Fehlschlag darf nicht als „nichts da" durchgehen: wer keine
     Berechtigung hat oder eine kaputte Verbindung, las bisher dieselbe
     beruhigende Meldung wie jemand mit leerem Postfach — und haette echte
     Zuschriften nie zu Gesicht bekommen. */
  const fehlertext = !error
    ? null
    : error instanceof ApiException && error.status === 403
      ? t('forbidden')
      : t('error');

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div className="feedback-admin__filters">
          {FILTER.map((wert) => (
            <button
              key={wert}
              type="button"
              className={`btn btn--sm ${art === wert ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setArt(wert)}
            >
              {t(`kinds.${wert}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`btn btn--sm ${nurOffene ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setNurOffene((v) => !v)}
        >
          {nurOffene ? t('showingOpen') : t('showingAll')}
        </button>
      </div>

      {isLoading ? (
        <p className="widget-state">{t('loading')}</p>
      ) : fehlertext ? (
        <p className="widget-state widget-state--error">{fehlertext}</p>
      ) : eintraege.length === 0 ? (
        <p className="widget-state">{t('empty')}</p>
      ) : (
        <ul className="feedback-admin__list">
          {eintraege.map((eintrag) => (
            <li
              key={eintrag.id}
              className={`feedback-admin__item${eintrag.handledAt ? ' is-handled' : ''}`}
            >
              <div className="feedback-admin__meta">
                <span className="feedback-admin__kind">{t(`kinds.${eintrag.type}`)}</span>
                <time dateTime={eintrag.createdAt}>
                  {new Date(eintrag.createdAt).toLocaleString('de-DE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
                {/* Ohne Benachrichtigung hat die Zuschrift niemanden erreicht —
                    das muss man sehen, sonst bleibt sie unbeantwortet liegen. */}
                {!eintrag.notifiedAt && (
                  <span className="feedback-admin__warn" title={t('notNotifiedHint')}>
                    <Mail01 />
                    {t('notNotified')}
                  </span>
                )}
              </div>

              <p className="feedback-admin__message">{eintrag.message}</p>

              <div className="feedback-admin__foot">
                <a href={`mailto:${eintrag.email}`} className="feedback-admin__from">
                  {eintrag.name} &lt;{eintrag.email}&gt;
                </a>
                <button
                  type="button"
                  className={`btn btn--sm ${eintrag.handledAt ? 'btn--ghost' : 'btn--primary'}`}
                  onClick={() => abhaken.mutate(eintrag.id)}
                  disabled={abhaken.isPending}
                >
                  <Check />
                  <span>{eintrag.handledAt ? t('reopen') : t('markHandled')}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
