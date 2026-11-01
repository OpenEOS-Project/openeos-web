'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

import { orderOnlyFaqUrl, tseFaqUrl } from '@/lib/cashless';

/**
 * Hinweis „Bargeld und TSE“, solange die Organisation Bargeld annimmt
 * (Standard). OpenEOS hat noch keine TSE-Anbindung; der Verein entscheidet
 * selbst, ob er Bargeld erfasst. Der bargeldlose Modus allein befreit nicht
 * von der TSE-Pflicht (der Verein kann ihn selbst ausschalten); TSE-frei ist
 * nur „Nur Bestellen“. Bewusst nur der abgestimmte Hinweistext und Links in
 * die FAQ, keine weitergehende Beratung.
 *
 * Steht in den Zahlungseinstellungen, in den Kasseneinstellungen und
 * einmalig (wegklickbar) im Dashboard.
 */
export function CashTseNotice({
  onDismiss,
  action,
  className,
}: {
  /** Wegklicken (Dashboard). */
  onDismiss?: () => void;
  /** Zusätzlicher Link hinter dem FAQ-Link, z. B. zu den Einstellungen. */
  action?: ReactNode;
  className?: string;
}) {
  const t = useTranslations('cashTse');
  const locale = useLocale();

  return (
    <div className={['cash-tse-notice', onDismiss ? 'cash-tse-notice--dismissible' : '', className ?? '']
      .filter(Boolean)
      .join(' ')}
    >
      <Banner tone="info" icon={<Icon name="info" />} title={t('title')}>
        {t.rich('text', {
          order: (chunks) => (
            <a href={orderOnlyFaqUrl(locale)} target="_blank" rel="noopener noreferrer" className="cash-tse-notice__link">
              {chunks}
            </a>
          ),
        })}{' '}
        <a href={tseFaqUrl(locale)} target="_blank" rel="noopener noreferrer" className="cash-tse-notice__link">
          {t('faqLink')}
        </a>
        {action ? <> · {action}</> : null}
      </Banner>
      {onDismiss && (
        <button type="button" className="cash-tse-notice__dismiss" onClick={onDismiss} aria-label={t('dismiss')}>
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}
