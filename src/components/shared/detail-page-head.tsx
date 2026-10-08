'use client';

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

import { Link } from '@/i18n/routing';

interface DetailPageHeadProps {
  /** Die Liste, aus der man kommt. */
  backHref: string;
  /** Vorgelesener Name des Zurück-Knopfs, z. B. „Zurück" oder „Alle Integrationen". */
  backLabel: string;
  /** Symbol in der grünen Kachel links neben dem Titel. */
  icon?: ReactNode;
  /** Eigenes Bild statt der Kachel (z. B. das Logo einer Integration). */
  logo?: ReactNode;
  title: ReactNode;
  /** Zeile unter dem Titel: Typ, Kürzel, Veranstaltung … */
  meta?: ReactNode;
  /** Status-Badges, stehen hinter dem Titel. */
  badges?: ReactNode;
  /** Knöpfe rechts — mit Beschriftung, höchstens einer primär. */
  actions?: ReactNode;
}

/**
 * Seitenkopf der Detailseiten (Gerät, Schichtplan, Benutzer, Integration).
 *
 * Listenseiten tragen im Kopf nur Titel und Beschreibung, ihre Aktionen
 * stehen im Kopf der Karte. Auf einer Detailseite gehören die Aktionen
 * dagegen zu dem einen Ding, um das es geht — sie stehen rechts im
 * Seitenkopf. Vorher sah jede Detailseite anders aus: das Gerät mit
 * umbrechendem Kopf, der Schichtplan als Karte mit Symbolknöpfen ohne
 * Beschriftung, die Integration mit Textlink darüber.
 */
export function DetailPageHead({ backHref, backLabel, icon, logo, title, meta, badges, actions }: DetailPageHeadProps) {
  return (
    <div className="app-page-head detail-head">
      <div className="app-page-head__copy detail-head__main">
        <Link href={backHref} className="btn btn--ghost detail-head__back" aria-label={backLabel} title={backLabel}>
          <ArrowLeft aria-hidden="true" />
        </Link>
        {logo ?? (icon && <span className="detail-head__icon" aria-hidden="true">{icon}</span>)}
        <div className="detail-head__text">
          <div className="detail-head__titlerow">
            <h1 className="app-page-head__title detail-head__title">{title}</h1>
            {badges}
          </div>
          {meta && <div className="app-page-head__sub detail-head__meta">{meta}</div>}
        </div>
      </div>
      {actions && <div className="app-page-head__actions detail-head__actions">{actions}</div>}
    </div>
  );
}
