'use client';

import { useTranslations } from 'next-intl';

/** Standard close button for .modal__head — replaces per-dialog inline SVG copies. */
export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('common');
  return (
    <button className="modal__close" type="button" onClick={onClick} aria-label={t('close')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
