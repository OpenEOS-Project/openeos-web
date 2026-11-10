'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Button, Chip, Chips, Field, Icon, Keypad, Spinner, type IconName } from '@openeos/ui';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCreateDeviceCashbookEntry, useDeviceCashbook } from '@/hooks/use-dsfinvk';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import {
  applyAmountKey,
  cashbookActionsFor,
  cashDifference,
  centsInputToEuros,
  differenceTone,
  openingBalancePrefill,
  sortEntriesNewestFirst,
  summaryRows,
} from '@/lib/dsfinvk';
import { tseNoticeKind } from '@/lib/tse';
import type {
  CashbookEntryResult,
  CashbookEntryType,
  CashbookEntryView,
  CashbookOpeningSuggestion,
} from '@/types/dsfinvk';

import { reportTse } from '../hooks/use-pos-tse';
import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';
import { PosTseReceipts } from './pos-tse-receipts';

const ICONS: Record<CashbookEntryType, IconName> = {
  opening_balance: 'cash',
  deposit: 'plus',
  withdrawal: 'minus',
  cash_count: 'list',
};

/** Schnellwahl für Anfangsbestand, Wechselgeld und Abschöpfung. */
const QUICK_AMOUNTS = [50, 100, 150, 200] as const;

interface CashbookSheetProps {
  open: boolean;
  onClose: () => void;
  /** Offline: Buchen gesperrt. */
  disabled?: boolean;
}

/**
 * Kassenbuch an der Kasse: Soll-Bestand dieser Schublade mit der
 * Aufschlüsselung des Tages, vier Buchungen (Anfangsbestand, Wechselgeld
 * aus Vereinskasse, Abschöpfung an Vereinskasse, Kassensturz) und die
 * heutigen Buchungen dieses Geräts. Jede Bargeldbewegung ist ein eigener
 * TSE-Beleg. Ohne früheren Kassensturz steht das Wechselgeld vorn.
 */
export function CashbookSheet({ open, onClose, disabled = false }: CashbookSheetProps) {
  const t = useTranslations('cashbook');
  const formatPrice = useFormatPrice();
  const { formatDate } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const day = useDeviceCashbook(open);
  const [action, setAction] = useState<CashbookEntryType | null>(null);
  const [last, setLast] = useState<CashbookEntryResult | null>(null);

  useEffect(() => {
    if (!open) {
      setAction(null);
      setLast(null);
    }
  }, [open]);

  const data = day.data;
  const entries = data ? sortEntriesNewestFirst(data.entries) : [];

  return (
    <>
      <PosSheet
        open={open && action === null}
        onClose={onClose}
        size="wide"
        icon="note"
        title={t('title')}
        subtitle={data ? t('businessDay', { date: formatDate(data.businessDate) }) : undefined}
      >
        {day.isLoading && !data ? (
          <div className="pos-center">
            <Spinner />
          </div>
        ) : day.isError && !data ? (
          <Banner tone="danger" icon={<Icon name="alert" />}>
            {apiErrorMessage(day.error, t('loadFailed'))}
          </Banner>
        ) : data ? (
          <div className="pos-cb" data-testid="pos-cashbook">
            {!data.cashAllowed && (
              <Banner tone="warn" icon={<Icon name="alert" />}>
                {t('cashNotAllowed')}
              </Banner>
            )}

            {last && <LastBooking result={last} />}

            <section className="pos-cb__total" aria-label={t('summary.expectedDevice')}>
              <div className="pos-cb__expected">
                <span className="oe-label">{t('summary.expectedDevice')}</span>
                <b data-testid="pos-cashbook-expected">{formatPrice(data.total.expected)}</b>
                {data.total.lastCount ? (
                  <small>
                    {t('summary.lastCountShort', {
                      counted: formatPrice(data.total.lastCount.counted),
                      difference: signed(data.total.lastCount.difference, formatPrice),
                    })}
                  </small>
                ) : (
                  <small>{t('summary.noCount')}</small>
                )}
              </div>
              <dl className="pos-sums pos-cb__sums">
                {summaryRows(data.total).map((row) => (
                  <div key={row.key}>
                    <dt>{t(`summary.${row.key}`)}</dt>
                    <dd>{signed(row.value, formatPrice)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="pos-cb__actions">
              {cashbookActionsFor(data.openingBalanceSuggestion).map((type) => (
                <Button
                  key={type}
                  variant={type === 'cash_count' ? 'primary' : 'secondary'}
                  size="lg"
                  className="pos-cb__action"
                  disabled={disabled || !data.cashAllowed}
                  onClick={() => {
                    setLast(null);
                    setAction(type);
                  }}
                  data-testid={`pos-cashbook-${type}`}
                >
                  <Icon name={ICONS[type]} />
                  {t(`actionLabels.${type}`)}
                </Button>
              ))}
            </div>

            <section className="pos-group">
              <span className="oe-label">{t('entries')}</span>
              {entries.length === 0 ? (
                <p className="pos-hint">{t('entriesEmpty')}</p>
              ) : (
                <ul className="pos-list" data-testid="pos-cashbook-entries">
                  {entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </PosSheet>

      <CashbookEntrySheet
        type={open ? action : null}
        expected={data?.total.expected ?? 0}
        suggestion={data?.openingBalanceSuggestion}
        onClose={() => setAction(null)}
        onBooked={(result) => {
          setLast(result);
          setAction(null);
        }}
      />
    </>
  );
}

function signed(value: number, format: (v: number) => string): string {
  return `${value > 0 ? '+' : ''}${format(value)}`;
}

function EntryRow({ entry }: { entry: CashbookEntryView }) {
  const t = useTranslations('cashbook');
  const formatPrice = useFormatPrice();
  const { formatTime } = useLocaleFormat();
  const tone = entry.amount < 0 ? 'minus' : entry.amount > 0 && entry.type !== 'opening_balance' ? 'plus' : 'zero';
  return (
    <li className="pos-list__row pos-cb__entry">
      <span className="pos-list__main">
        <b>{t(`types.${entry.type}`)}</b>
        <small>
          {formatTime(entry.createdAt)}
          {entry.type === 'cash_count' && entry.countedAmount !== null
            ? ` · ${t('countedOf', {
                counted: formatPrice(entry.countedAmount),
                expected: formatPrice(entry.expectedAmount ?? 0),
              })}`
            : ''}
          {entry.note ? ` · ${entry.note}` : ''}
        </small>
      </span>
      <span className="pos-cb__amount" data-tone={tone}>
        {signed(entry.amount, formatPrice)}
      </span>
    </li>
  );
}

/** Ergebnis der letzten Buchung: Betrag, Beleg-Nr., TSE-Zustand. */
function LastBooking({ result }: { result: CashbookEntryResult }) {
  const t = useTranslations('cashbook');
  const formatPrice = useFormatPrice();
  const notice = result.tse ? tseNoticeKind(result.tse) : null;
  const entry = result.entry;
  const title =
    entry.type === 'cash_count'
      ? Math.abs(entry.amount) < 0.005
        ? t('countNoDifference')
        : t('bookedCount', { difference: signed(entry.amount, formatPrice) })
      : t('booked', { type: t(`types.${entry.type}`), amount: formatPrice(Math.abs(entry.amount)) });
  return (
    <div className="pos-cb__last">
      <Banner
        tone={notice === 'failed' ? 'warn' : 'success'}
        icon={<Icon name={notice === 'failed' ? 'alert' : 'check-circle'} />}
        title={title}
      >
        <span data-testid="pos-cashbook-last">
          {notice === 'failed'
            ? `${t('tseFailed')}${result.tse?.bonNumber ? ` · ${t('bon', { bon: result.tse.bonNumber })}` : ''}`
            : result.tse?.bonNumber
              ? t('tseSigned', { bon: result.tse.bonNumber })
              : result.tse
                ? t('tseSignedNoBon')
                : t('noTse')}
        </span>
      </Banner>
      {result.tse && (
        <details className="pos-tse-details">
          <summary>
            <Icon name="shield" size={16} />
            {t('tseDetails')}
          </summary>
          <PosTseReceipts views={[result.tse]} qrSize={112} />
        </details>
      )}
    </div>
  );
}

interface CashbookEntrySheetProps {
  type: CashbookEntryType | null;
  /** Soll-Bestand dieser Schublade (Kassensturz). */
  expected: number;
  /** Zuletzt gezählter Bestand (Vorschlag für den Anfangsbestand). */
  suggestion?: CashbookOpeningSuggestion | null;
  onClose: () => void;
  onBooked: (result: CashbookEntryResult) => void;
}

/**
 * Eine Buchung: Betrag über den Ziffernblock (Cent), Notiz; beim
 * Kassensturz der gezählte Bestand mit Soll und laufender Differenz.
 */
function CashbookEntrySheet({ type, expected, suggestion, onClose, onBooked }: CashbookEntrySheetProps) {
  const t = useTranslations('cashbook');
  const tPay = useTranslations('pos.pay');
  const formatPrice = useFormatPrice();
  const { formatDate } = useLocaleFormat();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const create = useCreateDeviceCashbookEntry();
  const [digits, setDigits] = useState('');
  const [note, setNote] = useState('');
  const [quickPicked, setQuickPicked] = useState(false);

  useEffect(() => {
    if (type) {
      // Anfangsbestand: zuletzt gezählter Bestand vorbelegt (Restbestand).
      const prefill = openingBalancePrefill(type, suggestion);
      setDigits(prefill !== null ? String(Math.round(prefill * 100)) : '');
      setNote('');
      // Wie eine Schnellwahl: die erste Taste ersetzt den Vorschlag.
      setQuickPicked(prefill !== null);
    }
    // Nur beim Öffnen vorbelegen, nicht bei jedem Nachladen des Tages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const amount = centsInputToEuros(digits);
  const isCount = type === 'cash_count';
  const difference = cashDifference(amount, expected);
  const tone = differenceTone(difference);
  const allowsZero = type === 'cash_count' || type === 'opening_balance';
  const valid = !!type && (digits !== '' || allowsZero) && (amount > 0 || allowsZero) && amount <= 100000;

  const press = (key: string) => {
    const base = quickPicked ? '' : digits;
    setQuickPicked(false);
    setDigits(applyAmountKey(base, key));
  };

  const submit = async () => {
    if (!type || !valid) return;
    try {
      const result = await create.mutateAsync({
        type,
        amount,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      reportTse([result.tse]);
      const notice = result.tse ? tseNoticeKind(result.tse) : null;
      if (notice === 'failed') toast(t('tseFailed'), 'danger');
      else
        toast(
          result.tse?.bonNumber
            ? `${t(`bookedShort.${type}`)} · ${t('bon', { bon: result.tse.bonNumber })}`
            : t(`bookedShort.${type}`),
        );
      onBooked(result);
    } catch (error) {
      toast(apiErrorMessage(error, t('failed')), 'danger');
    }
  };

  return (
    <PosSheet
      open={!!type}
      onClose={() => !create.isPending && onClose()}
      dismissible={!create.isPending}
      size="md"
      icon={type ? ICONS[type] : 'cash'}
      title={type ? t(`types.${type}`) : ''}
      subtitle={type ? t(`dialog.text.${type}`) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            {t('dialog.cancel')}
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="oe-grow"
            disabled={!valid || create.isPending}
            loading={create.isPending}
            onClick={() => void submit()}
            data-testid="pos-cashbook-submit"
          >
            {!create.isPending && <Icon name="check" />}
            {type ? t(`dialog.confirm.${type}`) : ''}
          </Button>
        </>
      }
    >
      {type && (
        <div className="pos-cb-entry" data-testid="pos-cashbook-entry">
          <div className="oe-given">
            <span className="oe-label">{isCount ? t('dialog.counted') : t('dialog.amount')}</span>
            <b data-testid="pos-cashbook-amount">{digits ? formatPrice(amount) : ''}</b>
            {isCount ? (
              <span className="oe-change">{t('dialog.expectedLine', { expected: formatPrice(expected) })}</span>
            ) : (
              <span className="oe-change">{t('dialog.amountHint')}</span>
            )}
          </div>

          {isCount && (
            <div className="pos-cb-diff" data-tone={digits ? tone : 'none'} data-testid="pos-cashbook-difference" aria-live="polite">
              <span>{digits ? t(`dialog.difference_${tone}`) : t('dialog.differencePending')}</span>
              <b>{digits ? signed(difference, formatPrice) : '–'}</b>
            </div>
          )}

          {!isCount && (
            <Chips>
              {QUICK_AMOUNTS.map((value) => (
                <Chip
                  key={value}
                  className="pos-chip"
                  active={digits === String(value * 100)}
                  onClick={() => {
                    setDigits(String(value * 100));
                    setQuickPicked(true);
                  }}
                >
                  {formatPrice(value)}
                </Chip>
              ))}
            </Chips>
          )}

          <Keypad
            keys={['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'backspace']}
            onKey={press}
            labels={{ backspace: tPay('backspace') }}
            aria-label={tPay('keypad')}
            captureKeyboard
          />

          {isCount && <p className="pos-hint">{t('dialog.differenceHint')}</p>}
          {type === 'opening_balance' && suggestion && (
            <p className="pos-hint" data-testid="pos-cashbook-last-counted">
              {t('dialog.lastCounted', {
                date: formatDate(suggestion.fromBusinessDate),
                amount: formatPrice(suggestion.amount),
              })}
            </p>
          )}
          {(type === 'opening_balance' || type === 'deposit') && (
            <p className="pos-hint" data-testid="pos-cashbook-opening-hint">
              {t('dialog.openingHint')}
            </p>
          )}

          <Field label={t('dialog.note')} htmlFor="pos-cashbook-note">
            <input
              id="pos-cashbook-note"
              className="oe-input"
              value={note}
              maxLength={500}
              placeholder={t(`dialog.notePlaceholder.${type}`)}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
      )}
    </PosSheet>
  );
}
