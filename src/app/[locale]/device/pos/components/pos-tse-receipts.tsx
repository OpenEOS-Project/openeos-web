'use client';

import { useTranslations } from 'next-intl';

import { Button, Icon } from '@openeos/ui';

import { TseReceiptBlock } from '@/components/tse/tse-receipt-block';

import type { TseReceiptView } from '@/types/tse';

import { PosSheet } from './pos-sheet';

/**
 * TSE-Angaben einer oder mehrerer Buchungen an der Kasse: je Vorgang die
 * Art (Kassenbeleg, Gegenbeleg, Pfand-Auszahlung …) und der Block wie auf
 * dem Bon, mit QR-Code zum Abscannen (digitaler Beleg).
 */
export function PosTseReceipts({
  views,
  qrSize = 132,
}: {
  views: ReadonlyArray<TseReceiptView>;
  qrSize?: number;
}) {
  const tKind = useTranslations('tse.kind');
  if (views.length === 0) return null;
  return (
    <div className="pos-tse" data-testid="pos-tse-receipts">
      {views.map((view) => (
        <section key={view.id} className="pos-tse__item">
          <h4 className="pos-tse__kind">
            <Icon name="shield" size={14} />
            {tKind(view.kind)}
          </h4>
          <TseReceiptBlock view={view} qrSize={qrSize} variant="panel" />
        </section>
      ))}
    </div>
  );
}

interface PosTseSheetProps {
  /** Belege; `null` = Blatt geschlossen. */
  receipt: { title: string; subtitle?: string; views: TseReceiptView[] } | null;
  onClose: () => void;
}

/**
 * Abschluss einer Buchung ohne eigenes Ergebnisblatt (Teilzahlung,
 * Pfand-Auszahlung): zeigt den TSE-Beleg, solange die Kasse ihn braucht.
 */
export function PosTseSheet({ receipt, onClose }: PosTseSheetProps) {
  const t = useTranslations('pos.tse');
  return (
    <PosSheet
      open={!!receipt}
      onClose={onClose}
      size="md"
      icon="check-circle"
      iconTone="accent"
      title={receipt?.title ?? ''}
      subtitle={receipt?.subtitle}
      footer={
        <Button variant="primary" size="lg" className="oe-grow" onClick={onClose}>
          {t('done')}
        </Button>
      }
    >
      {receipt && <PosTseReceipts views={receipt.views} />}
    </PosSheet>
  );
}
