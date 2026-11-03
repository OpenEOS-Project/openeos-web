'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Icon, type IconName } from '@openeos/ui';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { Link } from '@/i18n/routing';
import { OPERATING_MODE_SETTINGS_HREF } from '@/lib/operating-mode';
import { tseHint, type TseEventCheck, type TseHint, type TseHintAction, type TseSetupStep } from '@/lib/tse';

import '@/styles/tse.css';

const TONE_ICON: Record<TseHint['tone'], IconName> = {
  ok: 'check-circle',
  info: 'info',
  warn: 'alert',
  danger: 'alert',
};

const BANNER_TONE = { ok: 'success', info: 'info', warn: 'warn', danger: 'danger' } as const;

interface TseStepHintProps {
  step: TseSetupStep;
  eventCheck?: TseEventCheck;
  /** Nächste Veranstaltung, die sich freischalten lässt (sonst: neue anlegen). */
  unlockEvent?: { id: string; name: string } | null;
  /** `card`: eine Zeile unten auf der Katalogkarte; `banner`: Seite und Infofenster. */
  variant: 'card' | 'banner';
  /**
   * Aktionen je Grund. Land und Veranstaltung verlinkt der Hinweis selbst;
   * Schalter und „Jetzt einrichten“ gibt der Aufrufer mit, weil sie je
   * Ort anders aussehen. `null` blendet eine Aktion aus.
   */
  actions?: Partial<Record<Exclude<TseHintAction, null>, ReactNode | null>>;
  /** Weitere Links hinter der Aktion (Katalog: „Alle Voraussetzungen“). */
  extra?: ReactNode;
  onNavigate?: () => void;
}

/**
 * Der konkrete Grund, an dem die Cloud-TSE gerade hängt, mit der Aktion,
 * die ihn behebt (Land festlegen, Veranstaltung freischalten, einschalten,
 * einrichten). Texte: `integrations.tse.hint.<key>`.
 */
export function TseStepHint({ step, eventCheck, unlockEvent, variant, actions = {}, extra, onNavigate }: TseStepHintProps) {
  const t = useTranslations('integrations.tse.hint');
  const { formatDate } = useLocaleFormat();
  const hint = tseHint(step);

  const values = {
    date: eventCheck?.availableFrom ? formatDate(eventCheck.availableFrom) : '–',
    name: eventCheck?.event?.name ?? '',
    start: eventCheck?.event?.startDate ? formatDate(eventCheck.event.startDate) : '–',
  };

  const linkClass = variant === 'card' ? 'btn btn--secondary btn--xs' : 'btn btn--secondary btn--sm';
  const defaults: Partial<Record<Exclude<TseHintAction, null>, ReactNode>> = {
    set_country: (
      <Link href={OPERATING_MODE_SETTINGS_HREF} className={linkClass} onClick={onNavigate} data-testid="tse-hint-set-country">
        <Icon name="pin" size={14} />
        {t('countryMissing.action')}
      </Link>
    ),
    unlock_event: (
      <Link
        href={unlockEvent ? `/events?unlock=${unlockEvent.id}` : '/events?create=1'}
        className={variant === 'card' ? 'btn btn--primary btn--xs' : 'btn btn--primary btn--sm'}
        onClick={onNavigate}
        data-testid="tse-hint-unlock-event"
      >
        <Icon name={unlockEvent ? 'ticket' : 'calendar'} size={14} />
        {unlockEvent
          ? t('paidEventRequired.actionUnlock', { name: unlockEvent.name })
          : t('paidEventRequired.actionCreate')}
      </Link>
    ),
  };
  const action = hint.action ? (hint.action in actions ? actions[hint.action] : defaults[hint.action]) : null;
  const footer =
    action || extra ? (
      <div className="tse-hint__action">
        {action}
        {extra}
      </div>
    ) : null;

  if (variant === 'banner') {
    return (
      <div data-testid="tse-hint" data-step={step}>
        <Banner
          tone={BANNER_TONE[hint.tone]}
          icon={<Icon name={TONE_ICON[hint.tone]} />}
          title={t(`${hint.key}.title`, values)}
        >
          <p>{t(`${hint.key}.text`, values)}</p>
          {footer}
        </Banner>
      </div>
    );
  }

  return (
    <div className={`tse-hint tse-hint--${hint.tone}`} data-testid="tse-hint" data-step={step}>
      <span className="tse-hint__icon" aria-hidden="true">
        <Icon name={TONE_ICON[hint.tone]} size={16} />
      </span>
      <span className="tse-hint__copy">{t(`${hint.key}.short`, values)}</span>
      {footer}
    </div>
  );
}
