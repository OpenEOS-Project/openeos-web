'use client';

import { useTranslations } from 'next-intl';

import { useLegalVersions } from '@/hooks/use-legal';
import { formatCurrency } from '@/utils/format';
import type { EventBilling } from '@/types/billing';

import '@/styles/legal.css';

interface PurchaseSummaryProps {
  eventName: string;
  /** Zeitraum wie im Kopf des Dialogs („01.08.2026 – 03.08.2026“). */
  eventDate: string | null;
  billing: EventBilling;
  /** Gehört die Cloud-TSE mit der aktuellen Wahl dazu? */
  includesTse: boolean;
  tseSurcharge: number;
  total: number;
  locale: string;
}

/**
 * Übersicht direkt vor „Kostenpflichtig buchen“: was gebucht wird, für
 * welchen Zeitraum, zu welchem Preis und unter welchen AGB. Die Zahlen
 * kommen aus der Preisauskunft, die der Dialog schon geladen hat.
 */
export function PurchaseSummary({
  eventName,
  eventDate,
  billing,
  includesTse,
  tseSurcharge,
  total,
  locale,
}: PurchaseSummaryProps) {
  const t = useTranslations('events.checkout.summary');
  const legal = useLegalVersions();
  const discounted = billing.discountPercent > 0;

  return (
    <section className="purchase-summary" aria-label={t('title')} data-testid="purchase-summary">
      <h3 className="purchase-summary__title">{t('title')}</h3>
      <dl className="purchase-summary__rows">
        <div>
          <dt>{t('event')}</dt>
          <dd>{eventName}</dd>
        </div>
        {eventDate && (
          <div>
            <dt>{t('period')}</dt>
            <dd>{eventDate}</dd>
          </div>
        )}
        <div>
          <dt>{t('service')}</dt>
          <dd>
            {t('serviceText', { days: billing.days })}
            {includesTse && <span className="purchase-summary__sub">{t('tseIncluded')}</span>}
          </dd>
        </div>
        <div>
          <dt>{t('days')}</dt>
          <dd>{t('daysValue', { days: billing.days, pricePerDay: formatCurrency(billing.pricePerDay, locale) })}</dd>
        </div>
        {discounted && (
          <div>
            <dt>{t('discount')}</dt>
            <dd>
              {billing.discountReason === 'first-event'
                ? t('discountFirstEvent', { percent: billing.discountPercent })
                : t('discountPercent', { percent: billing.discountPercent })}
              <span className="purchase-summary__sub">
                {t('discountFrom', { price: formatCurrency(billing.price, locale) })}
              </span>
            </dd>
          </div>
        )}
        {tseSurcharge > 0 && (
          <div>
            <dt>{t('tseSurcharge')}</dt>
            <dd>{formatCurrency(tseSurcharge, locale)}</dd>
          </div>
        )}
        <div className="purchase-summary__total">
          <dt>{t('total')}</dt>
          <dd data-testid="purchase-summary-total">{formatCurrency(total, locale)}</dd>
        </div>
      </dl>
      <p className="purchase-summary__fine">{t('noVat')}</p>
      {legal.versions.enabled && (
        <p className="purchase-summary__fine">
          {t.rich('terms', {
            agb: (chunks) => (
              <a href={legal.versionUrl('agb')} target="_blank" rel="noopener noreferrer">
                {chunks}
              </a>
            ),
          })}
        </p>
      )}
    </section>
  );
}
