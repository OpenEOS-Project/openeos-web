'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banner, Button, Icon, Spinner } from '@openeos/ui';

import { SettlementFigures } from '@/components/waiters/settlement-figures';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { deviceApi } from '@/lib/api-client';
import { isLeadWaiter, settlementBlocked, textOn, waiterInitials } from '@/lib/waiters';
import { ApiException } from '@/types/api';
import type { DeviceWaiterTile, PosWaiter, SettlementOpenTable, WaiterSettlement } from '@/types/waiter';

import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';
import { WaiterHandoverSheet } from './waiter-handover-sheet';

export type WaiterSettleMode = 'summary' | 'settle';

interface WaiterSettleSheetProps {
  /** `null` = geschlossen. */
  mode: WaiterSettleMode | null;
  onClose: () => void;
  /** Angemeldete Bedienung bzw. Mitglied. */
  me: PosWaiter;
  /** Aktive Bedienungen (Auswahl der Schichtleitung, Übergabe). */
  tiles: DeviceWaiterTile[];
  /** Offline: nichts buchen. */
  disabled?: boolean;
}

/**
 * „Mein Zwischenstand“ und „Abrechnen“ an der Kasse (bedienungen-plan.md
 * §6, §7). Den Zwischenstand sieht jede Bedienung (unverbindlich, auf
 * Wunsch gedruckt); abrechnen darf eine Schichtleitung bzw. ein Admin für
 * jede Bedienung, sonst nur mit „Bedienungen rechnen selbst ab“. Offene
 * Tische werden übergeben oder (Schichtleitung) mit Notiz übergangen.
 */
export function WaiterSettleSheet({ mode, onClose, me, tiles, disabled = false }: WaiterSettleSheetProps) {
  const t = useTranslations('waiterSettlement');
  const tPos = useTranslations('pos.waiter');
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const formatPrice = useFormatPrice();
  const { formatDateTime } = useLocaleFormat();
  const queryClient = useQueryClient();
  const open = mode !== null;
  const lead = isLeadWaiter(me);

  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [settling, setSettling] = useState(mode === 'settle');
  const [force, setForce] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [handover, setHandover] = useState<SettlementOpenTable | null>(null);
  const [done, setDone] = useState<{ settlement: WaiterSettlement; printed: boolean } | null>(null);

  // Beim Öffnen frisch beginnen.
  useEffect(() => {
    if (!open) return;
    setSubjectId(undefined);
    setSettling(mode === 'settle');
    setForce(false);
    setNote('');
    setDone(null);
  }, [open, mode]);

  const summary = useQuery({
    queryKey: ['device-waiter-summary', subjectId ?? 'me'],
    queryFn: () => deviceApi.getWaiterSummary(subjectId),
    enabled: open && !done,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const data = summary.data?.data;
  const rights = summary.data?.meta ?? { canSettle: false, canForce: false };
  const openTables = data?.openTables ?? [];
  const blocked = settlementBlocked(openTables.length, force, note);
  const ownSubject = !subjectId || subjectId === me.waiterId;

  const pickable = lead ? tiles : [];
  const subjectName = data?.subject.name ?? me.name;

  const print = async () => {
    setPrinting(true);
    try {
      const res = await deviceApi.printWaiterSummary(subjectId);
      toast(res.data.printed ? t('toast.summaryPrinted') : t('toast.notPrinted'), res.data.printed ? 'success' : 'danger');
    } catch (error) {
      toast(apiErrorMessage(error, t('toast.notPrinted')), 'danger');
    } finally {
      setPrinting(false);
    }
  };

  const settle = async () => {
    setBusy(true);
    try {
      const res = await deviceApi.settleWaiter({
        waiterId: ownSubject ? undefined : subjectId,
        force: openTables.length > 0 ? force : undefined,
        note: note.trim() || null,
      });
      setDone({ settlement: res.data, printed: res.meta?.printed === true });
      void queryClient.invalidateQueries({ queryKey: ['device-waiter-summary'] });
    } catch (error) {
      if (error instanceof ApiException && error.reason === 'WAITER_OPEN_TABLES') void summary.refetch();
      toast(apiErrorMessage(error, t('errors.settle')), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const title = done
    ? done.settlement.number
      ? t('detail.title', { number: done.settlement.number })
      : t('detail.trainingTitle')
    : settling
      ? t('settleTitle')
      : t('summaryTitle');

  let body;
  if (done) {
    body = (
      <div className="pos-settle" data-testid="pos-settle-done">
        <Banner tone="success" icon={<Icon name="check-circle" />}>
          {done.settlement.number
            ? t('done.saved', { number: done.settlement.number, name: done.settlement.subject.name })
            : t('done.training', { name: done.settlement.subject.name })}
        </Banner>
        <p className="pos-hint">{done.printed ? t('done.printed') : t('done.notPrinted')}</p>
        <SettlementFigures totals={done.settlement.totals} />
      </div>
    );
  } else if (summary.isLoading) {
    body = (
      <div className="pos-center">
        <Spinner />
      </div>
    );
  } else if (summary.isError || !data) {
    body = (
      <Banner tone="danger" icon={<Icon name="alert" />}>
        {apiErrorMessage(summary.error, t('errors.summary'))}
      </Banner>
    );
  } else {
    body = (
      <div className="pos-settle" data-testid="pos-settle">
        {settling && pickable.length > 0 && (
          <section className="pos-group">
            <span className="oe-label">{t('pickWaiter')}</span>
            <div className="settle-targets" role="group" aria-label={t('pickWaiter')}>
              {pickable.map((tile) => {
                const active = (subjectId ?? me.waiterId) === tile.id;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    className="settle-target"
                    aria-pressed={active}
                    onClick={() => {
                      setSubjectId(tile.id === me.waiterId ? undefined : tile.id);
                      setForce(false);
                      setNote('');
                    }}
                  >
                    <span
                      className="settle-target__dot"
                      style={{ background: tile.color ?? 'var(--oe-ink)', color: textOn(tile.color) }}
                      aria-hidden
                    >
                      {waiterInitials(tile.shortName)}
                    </span>
                    {tile.shortName}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <p className="settle-period" data-testid="pos-settle-period">
          <b>{data.subject.name}</b>
          {' · '}
          {data.periodFrom
            ? t('period.since', { from: formatDateTime(data.periodFrom), number: data.lastSettlement?.number ?? '–' })
            : t('period.start')}
        </p>
        {data.empty ? <p className="pos-hint">{t('empty')}</p> : <SettlementFigures totals={data.totals} />}

        {openTables.length > 0 && (
          <div className="settle-open" data-testid="pos-settle-open">
            <h3>{t('openTables.title', { count: openTables.length })}</h3>
            <ul>
              {openTables.map((o) => (
                <li key={o.orderId}>
                  <span>
                    {o.tableNumber ? t('openTables.table', { table: o.tableNumber }) : `#${o.dailyNumber ?? o.orderNumber}`}
                    {o.openAmount !== undefined && (
                      <span className="settle-open__amount"> · {formatPrice(o.openAmount)}</span>
                    )}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setHandover(o)}
                    data-testid="pos-settle-handover"
                  >
                    {t('openTables.handOverShort')}
                  </Button>
                </li>
              ))}
            </ul>
            {settling && rights.canForce && (
              <div className="settle-force">
                <label>
                  <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                  <span>{t('force.label')}</span>
                </label>
                {force && (
                  <textarea
                    className="oe-input"
                    value={note}
                    maxLength={500}
                    placeholder={t('force.notePlaceholder')}
                    aria-label={t('force.note')}
                    onChange={(e) => setNote(e.target.value)}
                  />
                )}
              </div>
            )}
            {settling && !rights.canForce && <p className="pos-hint">{t('openTables.leadHint')}</p>}
          </div>
        )}
        {!settling && !rights.canSettle && <p className="pos-hint">{t('settleHint')}</p>}
      </div>
    );
  }

  const footer = done ? (
    <Button variant="primary" size="lg" onClick={onClose} data-testid="pos-settle-close">
      {t('done.close')}
    </Button>
  ) : settling ? (
    <div className="pos-settle__foot">
      <Button variant="secondary" size="lg" onClick={onClose}>
        {t('cancel')}
      </Button>
      <Button
        variant="primary"
        size="lg"
        disabled={disabled || busy || !data || data.empty || blocked || !rights.canSettle}
        onClick={() => void settle()}
        data-testid="pos-settle-submit"
      >
        <Icon name="receipt" />
        {t('submitAndPrint', { name: subjectName })}
      </Button>
    </div>
  ) : (
    <div className="pos-settle__foot">
      <Button variant="secondary" size="lg" disabled={disabled || printing || !data} onClick={() => void print()}>
        <Icon name="print" />
        {t('print')}
      </Button>
      {rights.canSettle && (
        <Button
          variant="primary"
          size="lg"
          disabled={disabled || !data}
          onClick={() => setSettling(true)}
          data-testid="pos-settle-start"
        >
          <Icon name="receipt" />
          {tPos('settle')}
        </Button>
      )}
    </div>
  );

  return (
    <>
      <PosSheet
        open={open && !handover}
        onClose={onClose}
        size="wide"
        icon="receipt"
        title={title}
        subtitle={data?.eventName ?? undefined}
        footer={footer}
      >
        {body}
      </PosSheet>
      <WaiterHandoverSheet
        order={handover}
        tiles={tiles}
        excludeId={data?.subject.waiterId ?? null}
        onClose={() => setHandover(null)}
        onDone={() => {
          setHandover(null);
          void summary.refetch();
        }}
      />
    </>
  );
}
