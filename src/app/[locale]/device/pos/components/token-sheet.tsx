'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Button, ChoiceGroup, EmptyState, Icon, Receipt, Stepper, type ChoiceOption, type ReceiptLine } from '@openeos/ui';
import { TseReceiptBlock } from '@/components/tse/tse-receipt-block';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import { tokenTenders, tokenValue, tokensValueCents, type TokenTransaction, type TokenType } from '@/types/token';
import type { PosCardMode } from '@/utils/pos-card-mode';
import { uuidV4 } from '@/utils/uuid';
import { reportTse } from '../hooks/use-pos-tse';
import { useSumupCheckout } from '../hooks/use-sumup-checkout';
import { quickAmounts } from './pay-sheet';
import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';

type SaleMethod = 'cash' | 'card';

export interface TokenSheetContext {
  title: string;
  eventName: string | null;
  deviceName: string;
  isTest: boolean;
  canPrint: boolean;
}

interface TokenSheetProps {
  /** `sale` = verkaufen, `buyback` = zurücktauschen, `null` = geschlossen. */
  mode: 'sale' | 'buyback' | null;
  onClose: () => void;
  tokenTypes: TokenType[];
  eventId?: string | null;
  card: PosCardMode;
  disabled?: boolean;
  context: TokenSheetContext;
}

/**
 * Wertmarken an der Kasse:
 * - **Verkaufen**: Marken je Typ zählen, bar (mit Rückgeld) oder mit Karte
 *   kassieren. Kein Umsatz — Mehrzweckgutschein (nicht steuerbar), bar im
 *   Kassenbuch.
 * - **Zurücktauschen**: nur Typen mit „Rücktausch erlaubt“, Bargeld raus,
 *   Beleg mit Unterschrift (druckt der Server immer).
 * Danach ein Abschluss mit Beleg-Vorschau, TSE-Angaben und „Bon drucken“.
 */
export function TokenSheet({ mode, onClose, tokenTypes, eventId, card, disabled = false, context }: TokenSheetProps) {
  const t = useTranslations('pos.tokens');
  const tDone = useTranslations('pos.done');
  const formatPrice = useFormatPrice();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<SaleMethod>('cash');
  const [given, setGiven] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(uuidV4());
  const [done, setDone] = useState<TokenTransaction | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);

  const buyback = mode === 'buyback';
  const types = useMemo(
    () => (buyback ? tokenTypes.filter((type) => type.buybackAllowed) : tokenTypes),
    [buyback, tokenTypes],
  );
  const totalCents = tokensValueCents(types, counts);
  const total = totalCents / 100;
  const quick = useMemo(() => quickAmounts(total), [total]);

  useEffect(() => {
    if (!mode) return;
    setCounts({});
    setMethod('cash');
    setGiven(null);
    setReason('');
    setBusy(false);
    setRequestId(uuidV4());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const finish = (tx: TokenTransaction) => {
    reportTse([tx.tse]);
    setPrinted(!!tx.printed);
    setDone(tx);
    onClose();
  };

  const sell = async (paymentMethod: 'cash' | 'card' | 'sumup_terminal', providerTransactionId?: string | null) => {
    setBusy(true);
    try {
      const res = await deviceApi.sellTokens({
        ...(eventId ? { eventId } : {}),
        lines: tokenTenders(counts),
        paymentMethod,
        ...(paymentMethod === 'cash' && given !== null ? { amountReceived: given } : {}),
        ...(providerTransactionId ? { providerTransactionId } : {}),
        clientRequestId: requestId,
      });
      if (res.data) finish(res.data);
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const sumup = useSumupCheckout(({ transactionId }) => {
    void sell('sumup_terminal', transactionId);
  });

  const payout = async () => {
    setBusy(true);
    try {
      const res = await deviceApi.buybackTokens({
        ...(eventId ? { eventId } : {}),
        lines: tokenTenders(counts),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        clientRequestId: requestId,
      });
      if (res.data) finish(res.data);
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const print = async () => {
    if (!done) return;
    setPrinting(true);
    try {
      const res = await deviceApi.printTokenTransaction(done.id, printed);
      if (res.data?.printed) {
        setPrinted(true);
        toast(tDone('printed'));
      } else toast(t('noPrinter'), 'danger');
    } catch {
      toast(tDone('printFailed'), 'danger');
    } finally {
      setPrinting(false);
    }
  };

  const methodOptions: ChoiceOption<SaleMethod>[] = [
    { id: 'cash', label: t('cash'), icon: 'cash' },
    ...(card && card !== 'sumup_test' ? [{ id: 'card' as const, label: t('card'), icon: 'contactless' as const }] : []),
  ];
  const change = given !== null ? Math.max(0, Math.round((given - total) * 100) / 100) : 0;
  const cardBusy = sumup.busy || sumup.state === 'success';

  let primary: React.ReactNode;
  if (buyback) {
    primary = (
      <Button
        variant="primary"
        className="oe-grow"
        loading={busy}
        disabled={disabled || totalCents <= 0}
        onClick={payout}
      >
        {!busy && <Icon name="cash" />}
        {t('buybackConfirm', { amount: formatPrice(total) })}
      </Button>
    );
  } else if (method === 'card' && card === 'sumup') {
    primary = sumup.busy ? (
      <Button variant="secondary" className="oe-grow" onClick={() => sumup.cancel()}>
        <Icon name="x" />
        {t('cardCancel')}
      </Button>
    ) : (
      <Button
        variant="primary"
        className="oe-grow"
        loading={busy || sumup.state === 'success'}
        disabled={disabled || totalCents <= 0}
        onClick={() => sumup.start(total)}
      >
        {!busy && <Icon name="contactless" />}
        {t('sellCard', { amount: formatPrice(total) })}
      </Button>
    );
  } else {
    primary = (
      <Button
        variant="primary"
        className="oe-grow"
        loading={busy}
        disabled={disabled || totalCents <= 0 || (method === 'cash' && given !== null && given < total)}
        onClick={() => sell(method === 'card' ? 'card' : 'cash')}
      >
        {!busy && <Icon name="check" />}
        {t('sellConfirm', { amount: formatPrice(total) })}
      </Button>
    );
  }

  const doneLines: ReceiptLine[] = (done?.lines ?? []).map((line) => ({
    qty: `${Math.abs(line.count)}x`,
    name: line.name,
    total: formatPrice((buybackDone(done) ? -1 : 1) * Math.abs(Number(line.amount))),
  }));

  return (
    <>
      <PosSheet
        open={!!mode}
        onClose={onClose}
        dismissible={!busy && !cardBusy}
        icon="ticket"
        title={buyback ? t('buybackTitle') : t('sellTitle')}
        subtitle={`${t('sum')}: ${formatPrice(total)}`}
        footer={
          <>
            <Button variant="ghost" disabled={busy || cardBusy} onClick={onClose}>
              {t('back')}
            </Button>
            {primary}
          </>
        }
      >
        <div data-testid={buyback ? 'token-buyback-sheet' : 'token-sale-sheet'}>
          {buyback && (
            <Banner tone="info" icon={<Icon name="info" />} title={t('buybackInfoTitle')}>
              {t('buybackInfo')}
            </Banner>
          )}
          {types.length === 0 ? (
            <EmptyState icon={<Icon name="ticket" />} title={buyback ? t('buybackEmpty') : t('empty')} />
          ) : (
            <ul className="pos-list">
              {types.map((type) => {
                const count = counts[type.id] || 0;
                return (
                  <li key={type.id} className="pos-list__row">
                    <span className="pos-list__main">
                      <b>
                        {type.color && (
                          <span
                            aria-hidden
                            style={{
                              display: 'inline-block',
                              width: 12,
                              height: 12,
                              borderRadius: 999,
                              background: type.color,
                              marginRight: 8,
                              verticalAlign: 'middle',
                            }}
                          />
                        )}
                        {type.name}
                      </b>
                      <small>
                        {formatPrice(tokenValue(type))} ·{' '}
                        {type.kind === 'single_purpose'
                          ? t('singlePurpose', { rate: Number(type.vatRate) })
                          : t('multiPurpose')}
                      </small>
                    </span>
                    <Stepper
                      value={count}
                      onDecrement={() => setCounts((p) => ({ ...p, [type.id]: Math.max(0, count - 1) }))}
                      onIncrement={() => setCounts((p) => ({ ...p, [type.id]: Math.min(9999, count + 1) }))}
                      labels={{ decrease: t('decrease', { name: type.name }), increase: t('increase', { name: type.name }) }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {!buyback && types.length > 0 && (
            <div className="pos-group">
              <ChoiceGroup
                options={methodOptions.map((o) => ({ ...o, disabled: busy || cardBusy }))}
                value={method}
                onChange={(id) => setMethod(id)}
                layout="row"
                aria-label={t('method')}
              />
              {method === 'cash' && totalCents > 0 && (
                <div className="pos-quick">
                  <Button variant={given === total ? 'primary' : 'secondary'} onClick={() => setGiven(total)}>
                    {t('exact')}
                  </Button>
                  {quick.map((value) => (
                    <Button key={value} variant={given === value ? 'primary' : 'secondary'} onClick={() => setGiven(value)}>
                      {formatPrice(value)}
                    </Button>
                  ))}
                </div>
              )}
              {method === 'cash' && given !== null && given >= total && (
                <p className="pos-hint">{t('change', { amount: formatPrice(change) })}</p>
              )}
              {method === 'card' && card === 'sumup' && sumup.state === 'failed' && (
                <Banner tone="danger" icon={<Icon name="alert" />}>
                  {sumup.error}
                </Banner>
              )}
              <p className="pos-hint">{t('saleHint')}</p>
            </div>
          )}
          {buyback && types.length > 0 && (
            <input
              className="oe-input"
              aria-label={t('reason')}
              placeholder={t('reason')}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </div>
      </PosSheet>
      {done && (
        <PosSheet open onClose={() => setDone(null)} size="done" title={t('doneTitle')} hideHeader>
          <div className="pos-done" data-testid="token-done">
            <span className="pos-done__ico">
              <Icon name="ticket" size={44} />
            </span>
            <h3>{buybackDone(done) ? t('buybackDone') : t('saleDone')}</h3>
            <p>
              <b>{formatPrice(Math.abs(Number(done.totalAmount)))}</b> ·{' '}
              {done.paymentMethod === 'cash' ? t('cash') : t('card')}
              {done.amountReceived !== null && Number(done.amountReceived) > Math.abs(Number(done.totalAmount)) && (
                <>
                  {' · '}
                  <b>
                    {tDone('change', {
                      amount: formatPrice(Number(done.amountReceived) - Math.abs(Number(done.totalAmount))),
                    })}
                  </b>
                </>
              )}
            </p>
            <Receipt
              className="pos-done__receipt"
              title={context.title}
              meta={done.transactionNumber}
              info={tDone('info', {
                event: context.eventName ?? '',
                device: context.deviceName,
                time: new Date(done.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
              })}
              lines={doneLines}
              sumLabel={t('sum')}
              sum={formatPrice((buybackDone(done) ? -1 : 1) * Math.abs(Number(done.totalAmount)))}
              note={context.isTest ? tDone('testReceipt') : t('receiptNote')}
              foot={
                done.tse ? (
                  <div className="pos-done__tse">
                    <TseReceiptBlock view={done.tse} qrSize={120} />
                  </div>
                ) : undefined
              }
            />
            <div className="pos-done__act">
              {context.canPrint && (
                <Button variant="ghost" loading={printing} onClick={print}>
                  {!printing && <Icon name="print" />}
                  {printed ? tDone('reprint') : tDone('print')}
                </Button>
              )}
              <Button variant="primary" className="oe-grow" onClick={() => setDone(null)}>
                {t('done')}
              </Button>
            </div>
          </div>
        </PosSheet>
      )}
    </>
  );
}

function buybackDone(tx: TokenTransaction | null): boolean {
  return tx?.kind === 'buyback';
}
