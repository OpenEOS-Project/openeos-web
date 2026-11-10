'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Banner, Button, Icon, Spinner } from '@openeos/ui';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { deviceApi } from '@/lib/api-client';
import { canPayOutCardTips, liveAuditDrawers, textOn, waiterInitials } from '@/lib/waiters';
import type { LiveCashAuditRow } from '@/types/waiter';

import { PosSheet } from './pos-sheet';
import '@/styles/settlements.css';
import { usePosToast } from './pos-toast';

interface WaiterLiveAuditSheetProps {
  open: boolean;
  onClose: () => void;
  /** Offline: keine Auszahlung. */
  disabled?: boolean;
}

/**
 * Live-Kassensturz an der Kasse (Schichtleitung): Soll bar jeder Bedienung
 * seit ihrer letzten Abrechnung und wo das Geld liegt — für eine
 * Kassen-Nachschau. Bei Arbeitnehmern lässt sich das offene
 * Kartentrinkgeld bar auszahlen (eigener TSE-Beleg, Quittung).
 */
export function WaiterLiveAuditSheet({ open, onClose, disabled = false }: WaiterLiveAuditSheetProps) {
  const t = useTranslations('waiterSettlement.live');
  const tTip = useTranslations('waiterSettlement.tipPayout');
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const formatPrice = useFormatPrice();
  const { formatDateTime, formatTime } = useLocaleFormat();
  const [confirm, setConfirm] = useState<LiveCashAuditRow | null>(null);
  const [paying, setPaying] = useState(false);

  const audit = useQuery({
    queryKey: ['device-live-cash-audit'],
    queryFn: async () => (await deviceApi.getLiveCashAudit()).data,
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const data = audit.data;

  const payOut = async (row: LiveCashAuditRow) => {
    if (!row.subject.waiterId || row.openCardTips === null) return;
    setPaying(true);
    try {
      const res = await deviceApi.payOutWaiterTips({ waiterId: row.subject.waiterId, amount: row.openCardTips });
      // Ein Hinweis: ein zweiter würde den ersten ersetzen.
      const paid = tTip('paid', { amount: formatPrice(res.data.amount), name: row.subject.name });
      toast(res.meta && !res.meta.printed ? `${paid} ${tTip('notPrintedPos')}` : paid, 'success');
      setConfirm(null);
      void audit.refetch();
    } catch (error) {
      toast(apiErrorMessage(error, tTip('failed')), 'danger');
    } finally {
      setPaying(false);
    }
  };

  let body;
  if (audit.isLoading) {
    body = (
      <div className="pos-center">
        <Spinner />
      </div>
    );
  } else if (audit.isError || !data) {
    body = (
      <Banner tone="danger" icon={<Icon name="alert" />}>
        {apiErrorMessage(audit.error, t('loadFailed'))}
      </Banner>
    );
  } else {
    body = (
      <div className="pos-settle" data-testid="pos-live-audit">
        <p className="pos-hint">{t('hint')}</p>
        <p className="settle-period" data-testid="pos-live-audit-stamp">
          {t('stamp', { at: formatDateTime(data.generatedAt), event: data.eventName ?? t('noEventName') })}
        </p>
        {data.rows.length === 0 ? (
          <p className="pos-hint">{data.eventId ? t('empty') : t('noEvent')}</p>
        ) : (
          <ul className="pos-list">
            {data.rows.map((row) => {
              const drawers = liveAuditDrawers(row);
              const confirming = confirm?.subject.id === row.subject.id;
              return (
                <li key={row.subject.id} className="pos-list__row pos-live-audit__row">
                  <span
                    className="settle-target__dot"
                    style={{ background: row.subject.color ?? 'var(--oe-ink)', color: textOn(row.subject.color) }}
                    aria-hidden
                  >
                    {waiterInitials(row.subject.name)}
                  </span>
                  <span className="pos-list__main">
                    <b>{row.subject.name}</b>
                    <small>
                      {t('posLine', {
                        card: formatPrice(row.payments?.card.amount ?? 0),
                        tips: formatPrice(row.tips ?? 0),
                        tables: row.openTables,
                      })}
                    </small>
                    {drawers.length > 0 && (
                      <small>
                        {drawers.map((d) => `${d.deviceName ?? t('noDevice')}: ${formatPrice(d.amount)}`).join(' · ')}
                      </small>
                    )}
                    {row.periodFrom && <small>{t('since', { from: formatTime(row.periodFrom) })}</small>}
                    {canPayOutCardTips(row.openCardTips) && row.openCardTips !== null && (
                      <span className="pos-live-audit__tips">
                        {confirming ? (
                          <>
                            <small>{tTip('confirm', { amount: formatPrice(row.openCardTips), name: row.subject.name })}</small>
                            <span style={{ display: 'flex', gap: 8 }}>
                              <Button variant="secondary" size="sm" onClick={() => setConfirm(null)} disabled={paying}>
                                {t('cancel')}
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => void payOut(row)}
                                disabled={paying || disabled}
                                loading={paying}
                                data-testid="pos-live-audit-payout-confirm"
                              >
                                {tTip('submit', { amount: formatPrice(row.openCardTips) })}
                              </Button>
                            </span>
                          </>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setConfirm(row)}
                            disabled={disabled}
                            data-testid="pos-live-audit-payout"
                          >
                            {t('payOutTips', { amount: formatPrice(row.openCardTips) })}
                          </Button>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="pos-live-audit__cash">
                    <small>{t('col.cashExpected')}</small>
                    <b>{row.cashExpected === null ? '—' : formatPrice(row.cashExpected)}</b>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {data.rows.length > 0 && (
          <dl className="pos-sums">
            <div>
              <dt>{t('totalCash')}</dt>
              <dd>{formatPrice(data.total.cashExpected)}</dd>
            </div>
            <div>
              <dt>{t('totalTips')}</dt>
              <dd>{formatPrice(data.total.tips)}</dd>
            </div>
          </dl>
        )}
        <p className="pos-hint">{t('tipsHint')}</p>
      </div>
    );
  }

  return (
    <PosSheet
      open={open}
      onClose={onClose}
      size="wide"
      icon="cash"
      title={t('title')}
      subtitle={data?.eventName ?? undefined}
      footer={
        <div className="pos-settle__foot">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t('close')}
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => void audit.refetch()}
            disabled={audit.isFetching}
            data-testid="pos-live-audit-refresh"
          >
            <Icon name="refresh" />
            {audit.isFetching ? t('refreshing') : t('refresh')}
          </Button>
        </div>
      }
    >
      {body}
    </PosSheet>
  );
}
