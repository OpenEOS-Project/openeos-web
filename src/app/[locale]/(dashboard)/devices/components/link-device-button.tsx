'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { LinkDeviceDialog } from './link-device-dialog';

/**
 * Der Weg, ein Gerät hinzuzufügen.
 *
 * Hieß vorher „Anzeige verbinden" und führte auf eine eigene Seite —
 * beides irreführend: Verbunden wird jede Art von Gerät, und die Liste,
 * in die es gehört, verschwand dabei aus dem Blick.
 */
export function LinkDeviceButton() {
  const t = useTranslations('devices');
  const [offen, setOffen] = useState(false);

  return (
    <>
      {/* Groesse und Form wie „Produkt erstellen" & Co. im Kartenkopf der
          anderen Listen — dort steht der Knopf jetzt auch. */}
      <button type="button" className="btn btn--primary" onClick={() => setOffen(true)}>
        {t('verify.cta')}
      </button>

      {offen && <LinkDeviceDialog onClose={() => setOffen(false)} />}
    </>
  );
}
