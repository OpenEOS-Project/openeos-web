'use client';

import { useLocale, useTranslations } from 'next-intl';

import '@/styles/settlements.css';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { formatTokenCount } from '@/lib/token-admin';
import type { SettlementCount, SettlementTotals } from '@/types/waiter';

interface SettlementFiguresProps {
  totals: SettlementTotals;
  /** Gezählt/Differenz (nur bei Abrechnungen, falls gezählt). */
  cashCounted?: number | null;
  difference?: number | null;
}

/**
 * Zahlen der Kellnerabrechnung bzw. des Zwischenstands (bedienungen-plan.md
 * §7), gleich in Kasse und Verwaltung. „Soll bar“ ist ohne
 * Kellnerbrieftasche nur informativ: das Bargeld liegt in der Schublade
 * der Kasse, an der kassiert wurde.
 */
export function SettlementFigures({ totals, cashCounted, difference }: SettlementFiguresProps) {
  const t = useTranslations('waiterSettlement');
  const locale = useLocale();
  const { formatCurrency } = useLocaleFormat();
  const money = (value: number) => formatCurrency(value);
  const counted = (label: string, c: SettlementCount, negative = false) => (
    <div className="settle-figs__row">
      <dt>
        {label} <span className="settle-figs__count">({c.count})</span>
      </dt>
      <dd>{money(negative && c.amount ? -c.amount : c.amount)}</dd>
    </div>
  );

  const training = totals.training;
  const tokens = totals.tokens;
  const tokensReceived = !!tokens && Math.round(tokens.received.amount * 100) !== 0;
  const hasTraining = training.orders > 0 || training.payments > 0;

  return (
    <div className="settle-figs" data-testid="settlement-figures">
      {totals.payments && (
        <section>
          <h3>{t('sections.collected')}</h3>
          <dl>
            {counted(t('rows.cash'), totals.payments.cash)}
            {counted(t('rows.card'), totals.payments.card)}
            {totals.payments.other.count > 0 && counted(t('rows.other'), totals.payments.other)}
            <div className="settle-figs__row settle-figs__row--total">
              <dt>
                {t('rows.total')} <span className="settle-figs__count">({totals.payments.total.count})</span>
              </dt>
              <dd>{money(totals.payments.total.amount)}</dd>
            </div>
            <div className="settle-figs__row settle-figs__row--sub">
              <dt>{t('rows.tips')}</dt>
              <dd>{money(totals.tips ?? 0)}</dd>
            </div>
          </dl>
        </section>
      )}

      {(totals.refunds || totals.pfandReturns) && (
        <section>
          <h3>{t('sections.refunded')}</h3>
          <dl>
            {totals.refunds && counted(t('rows.refundsCash'), totals.refunds.cash, true)}
            {totals.refunds && counted(t('rows.refundsNonCash'), totals.refunds.nonCash, true)}
            {totals.pfandReturns && counted(t('rows.pfand'), totals.pfandReturns, true)}
          </dl>
        </section>
      )}

      {/* Wertmarken: angenommene Marken gibt die Person ab wie Bargeld —
          sie stehen aber nicht in „Soll bar“. Verkauf bar und Rücktausch
          dagegen schon. */}
      {tokens && (
        <section data-testid="settlement-tokens">
          <h3>{t('tokens.section')}</h3>
          <dl>
            {tokens.receivedByType.map((type) => (
              <div key={type.tokenTypeId} className="settle-figs__row">
                <dt>{t('tokens.typeRow', { count: formatTokenCount(type.count, locale), name: type.name })}</dt>
                <dd>{money(type.amount)}</dd>
              </div>
            ))}
            {tokensReceived && (
              <div className="settle-figs__row settle-figs__row--total">
                <dt>
                  {t('tokens.received')}{' '}
                  <span className="settle-figs__count">({formatTokenCount(tokens.received.count, locale)})</span>
                </dt>
                <dd>{money(tokens.received.amount)}</dd>
              </div>
            )}
            {tokens.sold.count > 0 && counted(t('tokens.sold'), tokens.sold)}
            {tokens.sold.count > 0 && Math.round((tokens.sold.amount - tokens.soldCash) * 100) !== 0 && (
              <div className="settle-figs__row settle-figs__row--sub">
                <dt>{t('tokens.soldCash')}</dt>
                <dd>{money(tokens.soldCash)}</dd>
              </div>
            )}
            {tokens.boughtBack.count > 0 && counted(t('tokens.boughtBack'), tokens.boughtBack, true)}
          </dl>
          {tokensReceived && <p className="settle-figs__hint">{t('tokens.hint')}</p>}
        </section>
      )}

      <section>
        <h3>{t('sections.taken')}</h3>
        <dl>
          <div className="settle-figs__row">
            <dt>{t('rows.orders')}</dt>
            <dd>{totals.taken.orders}</dd>
          </div>
          <div className="settle-figs__row">
            <dt>{t('rows.items')}</dt>
            <dd>{totals.taken.items}</dd>
          </div>
          {totals.taken.revenue !== undefined && (
            <div className="settle-figs__row">
              <dt>{t('rows.revenue')}</dt>
              <dd>{money(totals.taken.revenue)}</dd>
            </div>
          )}
          {!!totals.taken.discounts && (
            <div className="settle-figs__row">
              <dt>{t('rows.discounts')}</dt>
              <dd>{money(-totals.taken.discounts)}</dd>
            </div>
          )}
        </dl>
      </section>

      {totals.cashExpected !== undefined && (
        <section className="settle-figs__cash" data-testid="settlement-cash">
          <div className="settle-figs__row settle-figs__row--total">
            <dt>{t('rows.cashExpected')}</dt>
            <dd>{money(totals.cashExpected)}</dd>
          </div>
          {(totals.cashByDevice ?? []).map((d) => (
            <div key={d.deviceId ?? 'none'} className="settle-figs__row settle-figs__row--sub">
              <dt>{t('rows.drawer', { name: d.deviceName ?? t('rows.unknownDevice') })}</dt>
              <dd>{money(d.amount)}</dd>
            </div>
          ))}
          {cashCounted !== undefined && cashCounted !== null && (
            <>
              <div className="settle-figs__row">
                <dt>{t('rows.counted')}</dt>
                <dd>{money(cashCounted)}</dd>
              </div>
              <div className="settle-figs__row settle-figs__row--total">
                <dt>{t('rows.difference')}</dt>
                <dd>{money(difference ?? 0)}</dd>
              </div>
            </>
          )}
          <p className="settle-figs__hint">{t('cashHint')}</p>
        </section>
      )}

      {totals.operatingMode === 'orders_only' && <p className="settle-figs__hint">{t('ordersOnlyHint')}</p>}

      {hasTraining && (
        <p className="settle-figs__training" data-testid="settlement-training">
          {t('training', { orders: training.orders, payments: training.payments })}
        </p>
      )}
    </div>
  );
}
