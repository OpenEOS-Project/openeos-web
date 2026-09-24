'use client';

import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { DeviceLinkFlow } from './device-link-flow';

interface LinkDeviceDialogProps {
  onClose: () => void;
}

/**
 * Gerät verbinden — als Dialog über der Geräteliste.
 *
 * Vorher führte der Weg auf eine eigene Seite. Das riss aus dem
 * Zusammenhang: Man verlässt die Liste, in die das neue Gerät gehört,
 * und muss hinterher zurückfinden. Im Dialog bleibt die Liste stehen und
 * füllt sich beim Schließen.
 */
export function LinkDeviceDialog({ onClose }: LinkDeviceDialogProps) {
  const t = useTranslations('devices');

  return (
    <div className="modal__overlay" role="presentation" onClick={onClose}>
      <div
        className="modal__panel modal__panel--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-device-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id="link-device-title" className="modal__title">
            {t('verify.title')}
          </h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <DeviceLinkFlow onFertig={onClose} />
        </div>
      </div>
    </div>
  );
}
