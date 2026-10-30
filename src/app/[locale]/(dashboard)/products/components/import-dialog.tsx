'use client';

import { useId, useState } from 'react';

import { useTranslations } from 'next-intl';

import '@/styles/products.css';
import { Tabs } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';

import { CsvImportSection } from './csv-import-section';
import { MenuImportSection } from './menu-import-section';

interface ImportDialogProps {
  eventId: string;
  onClose: () => void;
  /** Reiter „Speisekarte“ nur mit nutzbaren Assistent-Funktionen; sonst gibt es nur CSV. */
  menuAvailable: boolean;
}

type ImportTab = 'menu' | 'csv';

/**
 * Ein Einstieg für beide Importe: „Speisekarte“ (Fotos/PDF/Text, Assistent)
 * und „CSV“. Der Dialog wird beim Öffnen frisch eingehängt (der Container
 * rendert ihn nur, solange er offen ist), die Reiter bleiben beide
 * eingehängt — ein laufender Speisekarten-Import überlebt den Wechsel zu CSV.
 */
export function ImportDialog({ eventId, onClose, menuAvailable }: ImportDialogProps) {
  const t = useTranslations('products.import');
  const titleId = useId();
  const [tab, setTab] = useState<ImportTab>(menuAvailable ? 'menu' : 'csv');
  const [wide, setWide] = useState(false);

  const activeTab: ImportTab = menuAvailable ? tab : 'csv';
  const panelClass =
    wide && activeTab === 'menu'
      ? 'import-dialog__panel import-dialog__panel--wide'
      : 'import-dialog__panel';

  return (
    <div className="modal__overlay import-dialog__overlay" onClick={onClose}>
      <ModalPanel titleId={titleId} className={panelClass}>
        <div className="modal__head">
          <h2 id={titleId}>{t('title')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        {menuAvailable && (
          <Tabs<ImportTab>
            className="import-dialog__tabs"
            aria-label={t('title')}
            items={[
              { id: 'menu', label: t('tabs.menu') },
              { id: 'csv', label: t('tabs.csv') },
            ]}
            active={activeTab}
            onChange={setTab}
          />
        )}

        {menuAvailable && (
          <div className="import-dialog__tab" hidden={activeTab !== 'menu'}>
            <MenuImportSection eventId={eventId} onClose={onClose} onWideChange={setWide} />
          </div>
        )}
        <div className="import-dialog__tab" hidden={activeTab !== 'csv'}>
          <CsvImportSection eventId={eventId} onClose={onClose} />
        </div>
      </ModalPanel>
    </div>
  );
}
