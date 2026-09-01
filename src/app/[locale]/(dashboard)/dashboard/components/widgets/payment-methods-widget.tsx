'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { usePaymentsReport } from '@/hooks/use-reports';
import { formatCurrency } from '@/utils/format';
import { useDashboardRange } from '../dashboard-range';

interface Props {
  organizationId: string;
}

/**
 * Zahlungsart lesbar machen. Die API liefert den Schluessel aus der
 * Datenbank ("apple_pay"); der gehoert nicht auf ein Dashboard.
 * Unbekannte Schluessel werden durchgereicht, statt sie zu verschlucken.
 */
const METHOD_KEYS: Record<string, string> = {
  cash: 'cash',
  card: 'card',
  apple_pay: 'applePay',
  google_pay: 'googlePay',
  voucher: 'voucher',
};

export function PaymentMethodsWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');
  const range = useDashboardRange();

  const methodLabel = (method: string): string => {
    const key = METHOD_KEYS[method];
    return key ? t(`widgets.paymentMethods.methods.${key}`) : method;
  };

  const { data, isLoading } = usePaymentsReport(organizationId, range);

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('widgets.paymentMethods.label')}</h2>
          <p className="app-card__sub">{t('widgets.paymentMethods.subtitle', { period: t(`range.period.${range.key}`) })}</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <p className="empty-state__sub">{t('widgets.empty')}</p>
        </div>
      ) : (
        <div className="pay-rows">
          {data.map((row) => (
            /* Eine Zeile statt gestapelt: Beschriftung, Balken und
               Prozentwert nebeneinander wie in der Vorlage. Gestapelt
               wirkte die Liste ueber die Kachelbreite leer. */
            <div className="pay-row" key={row.method}>
              <span className="pay-row__label">{methodLabel(row.method)}</span>
              <span
                className="pay-row__bar"
                role="meter"
                aria-label={methodLabel(row.method)}
                aria-valuenow={Math.round(row.percentage)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ width: `${row.percentage}%` }} />
              </span>
              <span className="pay-row__value">{row.percentage.toFixed(1)} %</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
