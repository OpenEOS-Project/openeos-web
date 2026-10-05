'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Haengt Dialoge direkt an das .pos-root-Element der Seite.
 *
 * Der Warenkorb steckt auf dem Telefon in einem Bottom-Sheet mit
 * `will-change: transform`. Ein solches Element wird zum Bezugsrahmen fuer
 * `position: fixed` — die Dialoge darin (Barzahlung, Kartenzahlung, Bons,
 * Pfand) massen sich deshalb an den 75 % des Sheets statt am Bildschirm,
 * und beim Bar-Dialog verschwand die untere Ziffernreihe.
 *
 * Ziel ist .pos-root und nicht document.body: nur dort gelten die
 * --pos-*-Variablen. Ohne .pos-root (sollte nicht vorkommen) bleibt der
 * Inhalt an Ort und Stelle.
 */
export function PosPortal({ children }: { children: ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  // undefined = noch nicht gesucht, null = kein .pos-root gefunden
  const [target, setTarget] = useState<HTMLElement | null | undefined>(undefined);

  useLayoutEffect(() => {
    setTarget(anchorRef.current?.closest<HTMLElement>('.pos-root') ?? null);
  }, []);

  return (
    <>
      <span ref={anchorRef} hidden />
      {target === undefined ? null : target ? createPortal(children, target) : children}
    </>
  );
}
