'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

/**
 * Kennzeichnung „KI-generierter Vorschlag“ (Art. 50 KI-VO) an Inhalten,
 * die der Assistent mit einem Sprachmodell erzeugt hat — sichtbar, solange
 * der Vorschlag noch nicht übernommen ist. Dezent, aber nie versteckt;
 * in übernommene Daten wird nichts davon geschrieben.
 */
export function AiSuggestionLabel({ className }: { className?: string }) {
  const t = useTranslations('common.aiSuggestion');
  return (
    <span
      className={['ai-label', className].filter(Boolean).join(' ')}
      title={t('title')}
      data-testid="ai-suggestion-label"
    >
      <Sparkles aria-hidden="true" />
      {t('label')}
    </span>
  );
}
