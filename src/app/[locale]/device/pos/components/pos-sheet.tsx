'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { X } from '@untitledui/icons';
import { PosPortal } from './pos-portal';

/**
 * Gemeinsamer Rahmen fuer alle Dialoge der Kasse (Bar, Rabatt, Pfand,
 * Optionen, Offene Rechnungen, Bestellverlauf, Split-Zahlung).
 *
 * Auf dem Telefon ein Blatt, das von unten hereinfaehrt; ab Tablet-Breite
 * schwebt es mittig mit Abstand zum Rand (Regeln in pos.css unter
 * ".pos-sheet"). Haengt per Portal an .pos-root, damit es sich immer am
 * Bildschirm misst und die --pos-*-Farben gelten.
 *
 * Tastatur: Escape schliesst, Tab bleibt im Dialog, beim Schliessen
 * kehrt der Fokus zum ausloesenden Knopf zurueck. Liegen mehrere Dialoge
 * uebereinander (Bar ueber Offene Rechnungen), reagiert nur der oberste.
 */
interface PosSheetProps {
  /** Ausblend-Animation laeuft (siehe usePosSheetClose). */
  closing?: boolean;
  /** Schliessen per Hintergrund, Escape oder X. */
  onClose: () => void;
  title: ReactNode;
  /** Kleine Zeile unter dem Titel. */
  subtitle?: ReactNode;
  /** Feste Zeile zwischen Kopf und scrollbarem Inhalt (Filter, Umschalter). */
  toolbar?: ReactNode;
  /** Fester Bereich unter dem Inhalt, ohne Trennlinie (z. B. Ziffernblock). */
  pinned?: ReactNode;
  /** Fester Fuss mit Trennlinie (Summe, Bestaetigen). */
  footer?: ReactNode;
  children?: ReactNode;
  bodyStyle?: CSSProperties;
  /** Wischen am Griff: aktueller Versatz in px. */
  dragOffset?: number;
  dragging?: boolean;
  /** Pointer-Handler fuer den Griff; macht ihn groesser und greifbar. */
  handleProps?: HTMLAttributes<HTMLDivElement>;
}

export function PosSheet(props: PosSheetProps) {
  return (
    <PosPortal>
      <SheetLayer {...props} />
    </PosPortal>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function SheetLayer({
  closing = false,
  onClose,
  title,
  subtitle,
  toolbar,
  pinned,
  footer,
  children,
  bodyStyle,
  dragOffset = 0,
  dragging = false,
  handleProps,
}: PosSheetProps) {
  const tUi = useTranslations('deviceUi.common');
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Fokus hinein beim Oeffnen, zurueck beim Schliessen.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    // Nur der oberste Dialog reagiert — Portale haengen in der Reihenfolge
    // des Oeffnens an .pos-root, der letzte liegt oben.
    const isTop = () => {
      const modals = document.querySelectorAll('[aria-modal="true"]');
      return modals[modals.length - 1] === panel;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTop()) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);
      if (e.shiftKey && (!inside || active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    // Wechselt der Inhalt (z. B. Rabatt-Bon -> Betragseingabe), verschwindet
    // der gerade getippte Knopf und der Fokus faellt auf <body>. Dann zurueck
    // in den Dialog, sonst liest ein Screenreader ins Leere.
    const observer = new MutationObserver(() => {
      if (document.activeElement === document.body && isTop()) panel.focus({ preventScroll: true });
    });
    observer.observe(panel, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="pos-sheet-layer" data-closing={closing || undefined}>
      <div className="pos-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="pos-sheet"
        data-dragging={dragging || undefined}
        style={!closing && dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
      >
        <div
          className="pos-sheet__handle"
          data-draggable={handleProps ? true : undefined}
          {...handleProps}
        >
          <span />
        </div>

        <div className="pos-sheet__head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id={titleId} className="pos-sheet__title">
              {title}
            </h2>
            {subtitle != null && <div className="pos-sheet__sub">{subtitle}</div>}
          </div>
          <button type="button" className="pos-sheet__close" onClick={onClose} aria-label={tUi('close')}>
            <X />
          </button>
        </div>

        {toolbar != null && <div className="pos-sheet__toolbar">{toolbar}</div>}

        <div className="pos-sheet__body pos-scroll" style={bodyStyle}>
          {children}
        </div>

        {pinned != null && <div className="pos-sheet__pinned">{pinned}</div>}
        {footer != null && <div className="pos-sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Ausblenden mit Animation: `close()` startet sie, nach `delay` ms wird
 * `onClose` aufgerufen. Mehrfaches Tippen auf Schliessen zaehlt einmal.
 */
export function usePosSheetClose(isOpen: boolean, onClose: () => void, delay = 200) {
  const [closing, setClosing] = useState(false);
  const pending = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      pending.current = false;
      setClosing(false);
    }
  }, [isOpen]);

  const close = useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    setClosing(true);
    window.setTimeout(() => {
      onCloseRef.current();
      pending.current = false;
      setClosing(false);
    }, delay);
  }, [delay]);

  return { closing, close };
}
