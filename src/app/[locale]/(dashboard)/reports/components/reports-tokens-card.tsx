'use client';

import { useLocale, useTranslations } from 'next-intl';

import { useTokenReport, type TokenReportQuery } from '@/hooks/use-token-types';
import { Link } from '@/i18n/routing';
import { formatTokenCount, tokenRowHasMovement } from '@/lib/token-admin';
import type { TokenFigures } from '@/types/token';
import { formatCurrency } from '@/utils/format';

interface ReportsTokensCardProps {
  organizationId: string;
  query: TokenReportQuery;
  /** „Nur Bons“: kein Geld, also auch keine Wertmarken. */
  orderOnly?: boolean;
}

/**
 * Wertmarken im Zeitraum: verkauft (kein Umsatz — Umsatz entsteht beim
 * Einlösen), eingelöst (steckt im Umsatz), zurückgetauscht und im Umlauf.
 * Ohne jede Bewegung entfällt die Karte (die meisten Organisationen haben
 * keine Marken).
 */
export function ReportsTokensCard({ organizationId, query, orderOnly = false }: ReportsTokensCardProps) {
  const t = useTranslations('reports.tokens');
  const locale = useLocale();
  const report = useTokenReport(organizationId, query, !orderOnly);
  const totals = report.data?.totals;

  if (orderOnly || !totals || !tokenRowHasMovement(totals)) return null;

  const money = (value: number) => formatCurrency(value, locale);
  const pieces = (figures: TokenFigures) => t('pieces', { count: formatTokenCount(figures.count, locale) });

  return (
    <div className="app-card app-card--flat" data-testid="reports-tokens">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('title')}</h2>
          <p className="app-card__sub">{t('subtitle')}</p>
        </div>
        <Link href="/tokens" className="btn btn--ghost" style={{ fontSize: 13 }}>
          {t('details')}
        </Link>
      </div>
      <div className="stat-cards" style={{ padding: '0 20px 20px' }}>
        <div className="stat-card">
          <div className="stat-card__label">{t('sold')}</div>
          <div className="stat-card__value">{money(totals.sold.amount)}</div>
          <div className="stat-card__sub">{t('soldSub', { pieces: pieces(totals.sold) })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">{t('redeemed')}</div>
          <div className="stat-card__value">{money(totals.redeemed.amount)}</div>
          <div className="stat-card__sub">{t('redeemedSub', { pieces: pieces(totals.redeemed) })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">{t('boughtBack')}</div>
          <div className="stat-card__value">{money(totals.boughtBack.amount)}</div>
          <div className="stat-card__sub">{pieces(totals.boughtBack)}</div>
        </div>
        <div className="stat-card stat-card--accent">
          <div className="stat-card__label">{t('outstanding')}</div>
          <div className="stat-card__value">{money(totals.outstanding.amount)}</div>
          <div className="stat-card__sub">{t('outstandingSub', { pieces: pieces(totals.outstanding) })}</div>
        </div>
      </div>
    </div>
  );
}
