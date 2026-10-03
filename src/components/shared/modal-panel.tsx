'use client';

import type { MouseEvent, ReactNode } from 'react';

interface ModalPanelProps {
  /** Id des Titels im Dialog; wird fuer aria-labelledby benoetigt. */
  titleId: string;
  className?: string;
  children: ReactNode;
}

/**
 * Teilt sich das Markup mit dem alten modal__panel-Muster, ergaenzt aber die
 * ARIA-Attribute (role="dialog", aria-modal, aria-labelledby), die
 * Screenreadern einen Dialog ueberhaupt erst als solchen ankuendigen.
 */
export function ModalPanel({ titleId, className, children }: ModalPanelProps) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className={className ? `modal__panel ${className}` : 'modal__panel'}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}
