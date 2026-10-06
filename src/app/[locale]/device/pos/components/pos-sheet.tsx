'use client';

import { createContext, useContext, type ComponentProps } from 'react';
import { useTranslations } from 'next-intl';
import { Sheet } from '@openeos/ui';

/**
 * Dünner Rahmen um `Sheet` aus @openeos/ui für alle Dialoge der Kasse.
 *
 * Das Blatt hängt per Portal an der Ebene der Kasse (`.oe-root` in
 * `.pos-app`), damit Schrift, Fokusring und Knopf-Reset des
 * Designsystems gelten. Ohne Ebene landet es an `document.body`.
 */
const PosLayerContext = createContext<HTMLElement | null>(null);

export const PosLayerProvider = PosLayerContext.Provider;

export function usePosLayer() {
  return useContext(PosLayerContext);
}

type PosSheetProps = Omit<ComponentProps<typeof Sheet>, 'container' | 'closeLabel'>;

export function PosSheet(props: PosSheetProps) {
  const layer = usePosLayer();
  const t = useTranslations('deviceUi.common');
  return <Sheet {...props} container={layer} closeLabel={t('close')} />;
}
