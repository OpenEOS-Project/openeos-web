'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon } from '@openeos/ui';
import { TableKeypad } from './table-keypad';

interface PosStartViewProps {
  onOpenTable: (label: string) => void;
  /** Hinweise über dem Ziffernblock (Testmodus, Offline). */
  notices?: React.ReactNode;
}

/**
 * Startansicht „Tisch öffnen“ im Tischbetrieb. Fachlich wie bisher eine
 * freie Tischnummer; Tischliste, Karte und „Ohne Tisch“ folgen mit den
 * vordefinierten Tischen.
 */
export function PosStartView({ onOpenTable, notices }: PosStartViewProps) {
  const t = useTranslations('pos.order');
  const [input, setInput] = useState('');

  const submit = () => {
    const label = input.trim();
    if (!label) return;
    onOpenTable(label);
    setInput('');
  };

  return (
    <section className="pos-start" aria-labelledby="pos-start-title">
      <div className="pos-start__main oe-scroll">
        <div className="pos-start__hd">
          <h1 id="pos-start-title">{t('startTitle')}</h1>
          <p>{t('startSubtitle')}</p>
        </div>
        {notices}
        <div className="pos-start__pad">
          <TableKeypad value={input} onChange={setInput} onSubmit={submit} captureKeyboard />
          <Button variant="primary" size="lg" block disabled={!input} onClick={submit}>
            <Icon name="arrow-right" />
            {input ? t('openTable', { label: input }) : t('enterNumber')}
          </Button>
        </div>
      </div>
    </section>
  );
}
