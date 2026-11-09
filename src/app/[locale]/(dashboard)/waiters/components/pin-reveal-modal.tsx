'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { pinSheetPages, waiterLabel } from '@/lib/waiters';

import { WaiterBadge } from './waiter-badge';

export interface RevealedPin {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  pin: string;
  eventId: string | null;
}

interface PinRevealModalProps {
  pins: RevealedPin[];
  organizationName: string;
  eventName: (eventId: string | null) => string | null;
  onClose: () => void;
}

const PRINT_CLASS = 'printing-waiter-pins';

/**
 * Neue PINs, einmalig sichtbar: gespeichert ist nur ein Prüfwert. Von hier
 * aus der PIN-Zettel (A4 mit Schnittlinien, im Browser gedruckt).
 */
export function PinRevealModal({ pins, organizationName, eventName, onClose }: PinRevealModalProps) {
  const t = useTranslations('waiters');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const done = () => document.body.classList.remove(PRINT_CLASS);
    window.addEventListener('afterprint', done);
    return () => {
      window.removeEventListener('afterprint', done);
      done();
    };
  }, []);

  const print = () => {
    document.body.classList.add(PRINT_CLASS);
    window.print();
  };

  return (
    <>
      <div className="modal__overlay">
        <ModalPanel titleId="pin-reveal-title" className="modal__panel--md">
          <div className="modal__head">
            <h2 id="pin-reveal-title">{t('reveal.title', { count: pins.length })}</h2>
            <DialogCloseButton onClick={onClose} />
          </div>
          <div className="modal__body">
            <div className="waiters-reveal__warn" role="note">
              <Icon name="lock" size={16} />
              <p>{t('reveal.onlyNow')}</p>
            </div>
            <ul className="waiters-reveal__list" data-testid="pin-reveal-list">
              {pins.map((row) => (
                <li key={row.id}>
                  <WaiterBadge name={row.name} color={row.color} size={28} />
                  <span className="waiters-reveal__name">{row.name}</span>
                  <span className="waiters-reveal__pin mono" aria-label={t('reveal.pinOf', { name: row.name })}>
                    {row.pin}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={print}>
              <Icon name="printer" size={16} />
              {t('reveal.print')}
            </button>
            <button type="button" className="btn btn--primary" onClick={onClose}>
              {t('reveal.done')}
            </button>
          </div>
        </ModalPanel>
      </div>
      {mounted &&
        createPortal(
          <div className="waiter-pin-sheet" aria-hidden>
            {pinSheetPages(pins).map((page, index) => (
              <section key={index} className="waiter-pin-page">
                {page.map((row) => (
                  <article key={row.id} className="waiter-pin-card">
                    <header>
                      <span>{organizationName}</span>
                      <span>{eventName(row.eventId) ?? t('scope.organization')}</span>
                    </header>
                    <div className="waiter-pin-card__who">
                      <WaiterBadge name={row.name} color={row.color} size={36} />
                      <span>
                        <b>{row.name}</b>
                        <small>{waiterLabel(row)}</small>
                      </span>
                    </div>
                    <div className="waiter-pin-card__pin">
                      <small>{t('sheet.pinLabel')}</small>
                      <b>{row.pin}</b>
                    </div>
                    <p>{t('sheet.howTo')}</p>
                    <p className="waiter-pin-card__privacy">{t('sheet.privacy')}</p>
                  </article>
                ))}
              </section>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
