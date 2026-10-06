'use client';

import { useState } from 'react';
import { Icon, type IconName } from '@openeos/ui';

import { posIconUrl } from '@/utils/product-icon';
import '@/styles/pos-icon.css';

interface PosIconImageProps {
  /** ID aus @openeos/pos-icons, z. B. `pils`. */
  id: string;
  /** Alternativtext; leer, wenn daneben der Produktname steht. */
  alt?: string;
  /** Linien-Icon, falls das Bild fehlt (unbekannte ID). */
  fallback?: IconName;
}

/**
 * Produktbild aus @openeos/pos-icons als <img> — füllt die umgebende
 * Icon-Box (Kachel, Liste, Formular). Die Dateien liegen unter
 * /pos-icons/ (scripts/sync-pos-icons.mjs).
 */
export function PosIconImage({ id, alt = '', fallback = 'utensils' }: PosIconImageProps) {
  const [failedId, setFailedId] = useState<string | null>(null);
  if (failedId === id) return <Icon name={fallback} />;
  return (
    // Statische 256-px-PNGs ohne Bildoptimierung; Next/Image bringt hier nichts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="pos-icon-img"
      src={posIconUrl(id)}
      alt={alt}
      width={256}
      height={256}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailedId(id)}
    />
  );
}
