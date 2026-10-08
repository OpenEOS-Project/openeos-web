'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, type IconName } from '@openeos/ui';
import { Button } from '@/components/ui/buttons/button';
import { cx } from '@/utils/cx';
import { isItemReady, type CardPhase, type StationItem, type StationOrderInfo } from '@/lib/station-board';

interface StationOrderCardProps {
  order: StationOrderInfo;
  items: StationItem[];
  onItemReady: (itemId: string) => void;
  /** Positionen, deren Fertigmeldung gerade unterwegs ist. */
  pendingItemIds: ReadonlySet<string>;
  /** `done`: alles fertig; `leaving`: wird ausgeblendet. */
  phase?: CardPhase;
  /** Im abgesetzten Bereich "Erledigt" (abgeschwaecht). */
  archived?: boolean;
  isNew?: boolean;
  variant?: 'service' | 'pickup';
}

function formatElapsed(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getTimerColor(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = diff / 60000;
  if (minutes > 15) return 'text-error-primary';
  if (minutes > 5) return 'text-warning-primary';
  return 'text-success-primary';
}

/** Merkzettel, den die Kasse einer To-go-Bestellung mitgibt
 *  (`TOGO_NOTE` in device/pos/hooks/use-pos-checkout.ts). */
const TOGO_NOTE = 'To-go';

type OrderContextKind = 'table' | 'service' | 'pickup' | 'togo' | 'counter';

/** Wo die Bestellung hingeht — die zweite Kopfzeile jeder Karte. */
function orderContext(
  order: Pick<StationOrderInfo, 'tableNumber' | 'source' | 'notes'>,
  variant: StationOrderCardProps['variant'],
): { kind: OrderContextKind; icon: IconName } {
  if (variant !== 'pickup') {
    return order.tableNumber ? { kind: 'table', icon: 'table' } : { kind: 'service', icon: 'utensils' };
  }
  if (order.notes?.trim() === TOGO_NOTE) return { kind: 'togo', icon: 'send' };
  if (order.source === 'online' || order.source === 'qr_order') return { kind: 'pickup', icon: 'box' };
  return { kind: 'counter', icon: 'beer' };
}

export function StationOrderCard({
  order,
  items,
  onItemReady,
  pendingItemIds,
  phase = 'open',
  archived = false,
  isNew,
  variant,
}: StationOrderCardProps) {
  const t = useTranslations('device.station');
  const tUi = useTranslations('deviceUi.station');
  const [elapsed, setElapsed] = useState(formatElapsed(order.createdAt));
  const [timerColor, setTimerColor] = useState(getTimerColor(order.createdAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(order.createdAt));
      setTimerColor(getTimerColor(order.createdAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  const isRush = order.priority === 'rush';
  const isHigh = order.priority === 'high';
  const context = orderContext(order, variant);
  const isDone = phase !== 'open';

  /* Kein farbiger Balken an der linken Kante mehr.
     Er sollte Bedienung von Abholung unterscheiden — beide Spalten sind
     aber ohnehin ueberschrieben. Und weil auf dieser Seite kein Tailwind
     geladen wird, kam von `border-l-4` nur der Standardrahmen des
     Browsers an: ein dicker dunkler Strich. */

  return (
    <div
      className={cx(
        /* Spalte statt Block: Im Raster sind die Karten einer Reihe gleich
           hoch, die Positionen stehen oben, der Rest bleibt leer — statt
           dass eine kurze Karte mittendrin endet. */
        'flex flex-col rounded-xl border bg-primary shadow-sm overflow-hidden transition-all',
        phase === 'leaving' ? 'scale-[0.98] opacity-0 duration-700' : 'duration-300',
        archived && 'opacity-60',
        /* `border-error-solid` gibt es nicht; der Rahmen fiel dadurch auf
           die Textfarbe zurueck — schwarz im Hellen, weiss im Dunkeln. */
        isDone
          ? 'border-2 border-green-500 dark:border-green-400'
          : isRush
          ? 'border-2 border-red-500 dark:border-red-400'
          : isHigh
            ? 'border-2 border-yellow-500 dark:border-yellow-400'
            : 'border-secondary',
        isNew && 'animate-pulse ring-2 ring-brand-500 ring-offset-2 ring-offset-bg-secondary'
      )}
    >
      {/* Kopf: immer zwei Zeilen, gleich hoch fuer jede Bestellart.
          Zeile 1 traegt Nummer, Dringlichkeit und Zeit, Zeile 2 den
          Kontext. Vorher stand "Abholung" als Abzeichen neben der Nummer
          und die zweite Zeile fehlte — die Abholkarten waren niedriger als
          die mit Tisch. */}
      <div
        className={cx(
          'flex flex-col gap-1 border-b px-4 py-3',
          isDone ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950' : 'border-secondary'
        )}
      >
        <div className="flex h-7 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg font-bold leading-7 text-primary">#{order.dailyNumber}</span>
            {!isDone && (isRush || isHigh) && (
              <span
                className={cx(
                  'inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-semibold uppercase leading-none ring-1 ring-inset',
                  isRush
                    ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800'
                    : 'bg-yellow-50 text-yellow-800 ring-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:ring-yellow-800'
                )}
              >
                {isRush ? tUi('priorityRush') : tUi('priorityHigh')}
              </span>
            )}
          </div>
          {isDone ? (
            <span
              role="status"
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-green-600 px-3 text-sm font-semibold text-white dark:bg-green-500 dark:text-green-950"
            >
              <Icon name="check" size={16} />
              {tUi('done')}
            </span>
          ) : (
            <span className={cx('shrink-0 text-lg font-mono font-semibold leading-7 tabular-nums', timerColor)}>
              {elapsed}
            </span>
          )}
        </div>
        <div className="flex h-5 min-w-0 items-center gap-1.5 text-sm leading-5 text-tertiary">
          <Icon name={context.icon} size={16} className="shrink-0" />
          <span className="shrink-0">
            {context.kind === 'table'
              ? `${t('table')} ${order.tableNumber}`
              : context.kind === 'service'
                ? tUi('service')
                : context.kind === 'pickup'
                  ? tUi('pickup')
                  : context.kind === 'togo'
                    ? tUi('togo')
                    : t('counter')}
          </span>
          {order.customerName && (
            <span className="min-w-0 truncate" title={order.customerName}>
              {'· '}
              {order.customerName}
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 divide-y divide-secondary">
        {items.map((item) => {
          const ready = isItemReady(item);
          return (
            <div key={item.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex-1 min-w-0">
                {/* Bis zu drei Zeilen statt einer: in der Kueche muss der ganze
                    Name lesbar sein, "Hausgemacht…" hilft dort niemandem. */}
                <div className={cx('flex items-start gap-2', ready && 'text-tertiary line-through decoration-2')}>
                  <span className={cx('shrink-0 font-semibold', !ready && 'text-primary')}>{item.quantity}x</span>
                  <span className={cx('line-clamp-3 break-words', !ready && 'text-primary')} title={item.productName}>
                    {item.productName}
                  </span>
                </div>
                {item.notes && (
                  <p className="text-xs text-tertiary mt-0.5">{item.notes}</p>
                )}
                {item.kitchenNotes && (
                  <p className="text-xs font-medium text-warning-primary mt-0.5">{item.kitchenNotes}</p>
                )}
              </div>
              {ready ? (
                /* Gleiche Groesse wie der Knopf: die Zeile springt nicht,
                   wenn aus "Fertig" der Status wird. */
                <span className="station-done rounded-lg bg-green-50 text-sm font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
                  <Icon name="check" className="station-done__icon" />
                  {t('ready')}
                </span>
              ) : (
                <Button
                  size="sm"
                  color="primary"
                  /* Der Ladekreis erbt sonst ein gedimmtes Weiss und
                     verschwindet fast im gruenen Knopf. */
                  className="station-done [&>[data-icon=loading]]:text-white"
                  onClick={() => onItemReady(item.id)}
                  /* Nur diese Position wartet; die anderen bleiben bedienbar. */
                  isLoading={pendingItemIds.has(item.id)}
                  aria-label={`${item.quantity}x ${item.productName}: ${t('ready')}`}
                >
                  {/* Groesse und Abstand ueber pos.css: Die Tailwind-Klassen
                      h-4 w-4 sind hier wirkungslos, das Symbol erschien in
                      seiner natuerlichen Groesse neben dem Text. */}
                  <Icon name="check-circle" className="station-done__icon" />
                  {t('ready')}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
