'use client';

import { useState, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Image01 } from '@untitledui/icons';

import { integrationScreenshotSrc, type IntegrationScreenshot } from '@/config/integrations';
import { cx } from '@/utils/cx';

interface IntegrationGalleryProps {
  screenshots: IntegrationScreenshot[];
}

/**
 * Bildstrecke im Infofenster einer Integration.
 *
 * Ein Bild zur Zeit statt einer Reihe: auf dem Telefon ist das Fenster
 * schmal, und ein Screenshot der Oberfläche ist nur in voller Breite
 * lesbar. Pfeiltasten blättern, sobald die Strecke den Fokus hat.
 */
export function IntegrationGallery({ screenshots }: IntegrationGalleryProps) {
  const t = useTranslations('integrations');
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  // Bilder, die nicht geladen werden konnten — sie bekommen einen neutralen
  // Platzhalter mit Alt-Text statt des Symbols für ein kaputtes Bild. Die
  // echten Screenshots entstehen später; bis dahin darf nichts kaputt wirken.
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  if (screenshots.length === 0) return null;

  const count = screenshots.length;
  const current = screenshots[index];
  const src = integrationScreenshotSrc(current, locale);
  const alt = t(current.altKey);

  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    }
  };

  return (
    <div
      className="integration-gallery"
      role="group"
      aria-roledescription={t('gallery.roleDescription')}
      aria-label={t('gallery.label')}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="integration-gallery__frame" aria-live="polite">
        {failed[src] ? (
          <div className="integration-gallery__placeholder" role="img" aria-label={alt}>
            <Image01 aria-hidden="true" />
            <span>{alt}</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={alt}
            className="integration-gallery__image"
            onError={() => setFailed((prev) => ({ ...prev, [src]: true }))}
          />
        )}
      </div>

      {count > 1 && (
        <div className="integration-gallery__controls">
          <button
            type="button"
            className="integration-gallery__nav"
            onClick={() => go(-1)}
            aria-label={t('gallery.previous')}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <div className="integration-gallery__dots">
            {screenshots.map((shot, i) => (
              <button
                key={shot.src}
                type="button"
                className={cx('integration-gallery__dot', i === index && 'is-active')}
                onClick={() => setIndex(i)}
                aria-label={t('gallery.goTo', { index: i + 1, count })}
                aria-current={i === index ? 'true' : undefined}
              />
            ))}
          </div>
          <button
            type="button"
            className="integration-gallery__nav"
            onClick={() => go(1)}
            aria-label={t('gallery.next')}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
      <p className="integration-gallery__caption">
        {alt} <span className="integration-gallery__counter">({index + 1}/{count})</span>
      </p>
    </div>
  );
}
