'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

/** Standard close button for .modal__head — replaces per-dialog inline SVG copies. */
export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('common');
  return (
    <button className="modal__close" type="button" onClick={onClick} aria-label={t('close')}>
      <Icon name="x" />
    </button>
  );
}
