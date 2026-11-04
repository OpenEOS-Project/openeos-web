'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';

/** Wert mit Kopierknopf — für das Abtippen in ELSTER. */
export function CopyValue({ value, mono = false }: { value: string | null | undefined; mono?: boolean }) {
  const t = useTranslations('legal.elster');
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="legal-facts__empty">–</span>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Zwischenablage gesperrt: der Wert steht lesbar daneben.
    }
  };

  return (
    <span className="legal-copy">
      <span className={mono ? 'legal-copy__value legal-copy__value--mono' : 'legal-copy__value'}>{value}</span>
      <button
        type="button"
        className="btn btn--ghost legal-copy__btn"
        onClick={() => void copy()}
        aria-label={copied ? t('copied') : t('copy')}
        title={copied ? t('copied') : t('copy')}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
    </span>
  );
}
