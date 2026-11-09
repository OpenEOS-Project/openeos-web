'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { countryName } from '@/lib/countries';
import type { TseRequirement, TseSetupInput, TseSetupStep } from '@/lib/tse';

import '@/styles/tse.css';

interface TseChecklistProps {
  requirements: TseRequirement[];
  input: TseSetupInput;
  step: TseSetupStep;
  /** `compact`: kurze Beschriftungen in einer Zeile (Betriebsart). */
  variant?: 'full' | 'compact';
}

/**
 * Voraussetzungen der Cloud-TSE als Checkliste: ✓ erfüllt, • offen; die,
 * an der es gerade hängt, ist hervorgehoben.
 */
export function TseChecklist({ requirements, input, step, variant = 'full' }: TseChecklistProps) {
  const t = useTranslations('integrations.tse.setup');
  const locale = useLocale();
  const { formatDate } = useLocaleFormat();
  const compact = variant === 'compact';
  const event = input.events?.event ?? null;

  const label = (requirement: TseRequirement): string => {
    switch (requirement.id) {
      case 'server':
        return step === 'coming_soon' ? t('check.serverComingSoon') : t('check.server');
      case 'country':
        if (compact) return t('check.country');
        if (step === 'country_missing') return t('check.countryMissing');
        if (step === 'country' && input.country) {
          return t('check.countryOther', { country: countryName(input.country, locale) });
        }
        return t('check.country');
      case 'masterData':
        return t('check.masterData');
      case 'paidEvent':
        return event && !compact
          ? t('check.paidEventNamed', { name: event.name, date: formatDate(event.startDate) })
          : t('check.paidEvent');
      case 'integration':
        return t('check.integration');
      case 'setup':
        if (compact || requirement.ok) return t('check.setup');
        if (step === 'creating') return t('check.setupCreating');
        if (step === 'too_early' && input.events?.availableFrom) {
          return t('check.setupFrom', { date: formatDate(input.events.availableFrom) });
        }
        if (step === 'ready') return t('check.setupReady');
        return t('check.setup');
    }
  };

  return (
    <ul
      className={`tse-checklist${compact ? ' tse-checklist--compact' : ''}`}
      aria-label={t('requirements')}
      data-testid="tse-checklist"
    >
      {requirements.map((requirement) => {
        const tone = requirement.ok ? 'ok' : requirement.current ? 'current' : 'open';
        return (
          <li
            key={requirement.id}
            className={`tse-check tse-check--${tone}`}
            data-requirement={requirement.id}
            data-state={tone}
          >
            <span className="tse-check__icon" aria-hidden="true">
              {requirement.ok ? <Icon name="check" size={compact ? 12 : 14} /> : <span className="tse-check__dot" />}
            </span>
            <span className="tse-check__label">
              {label(requirement)}
              <span className="oe-sr-only"> – {requirement.ok ? t('check.done') : t('check.open')}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
