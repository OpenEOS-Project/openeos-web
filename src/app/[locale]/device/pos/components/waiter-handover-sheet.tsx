'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { deviceApi } from '@/lib/api-client';
import { handoverTargets, textOn, waiterInitials } from '@/lib/waiters';
import type { DeviceWaiterTile } from '@/types/waiter';

import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';

interface WaiterHandoverSheetProps {
  /** Offene Bestellung (ihr Tisch wird übergeben); `null` = geschlossen. */
  order: { orderId: string; tableNumber: string | null } | null;
  tiles: DeviceWaiterTile[];
  /** Bisherige Bedienung (nicht wählbar). */
  excludeId: string | null;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * „Tisch übergeben“: neue verantwortliche Bedienung wählen. Alle offenen
 * Bestellungen dieses Tisches derselben Bedienung gehen mit
 * (bedienungen-plan.md Entscheidung 7).
 */
export function WaiterHandoverSheet({ order, tiles, excludeId, onClose, onDone }: WaiterHandoverSheetProps) {
  const t = useTranslations('waiterSettlement');
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const targets = handoverTargets(tiles, excludeId);

  const pick = async (tile: DeviceWaiterTile) => {
    if (!order) return;
    setBusy(true);
    try {
      const res = await deviceApi.transferOrder(order.orderId, tile.id, true);
      toast(t('toast.transferred', { count: res.data.orderIds.length, name: tile.shortName }));
      void queryClient.invalidateQueries({ queryKey: ['device-table-status'] });
      void queryClient.invalidateQueries({ queryKey: ['device-open-orders'] });
      onDone?.();
    } catch (error) {
      toast(apiErrorMessage(error, t('errors.transfer')), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PosSheet
      open={order !== null}
      onClose={onClose}
      icon="users"
      title={
        order?.tableNumber ? t('handover.titleTable', { table: order.tableNumber }) : t('handover.title')
      }
      subtitle={t('handover.subtitle')}
    >
      {targets.length === 0 ? (
        <p className="pos-hint">{t('handover.none')}</p>
      ) : (
        <div className="settle-targets" role="group" aria-label={t('handover.pick')} data-testid="pos-handover-targets">
          {targets.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className="settle-target"
              disabled={busy}
              onClick={() => void pick(tile)}
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
          ))}
        </div>
      )}
    </PosSheet>
  );
}
