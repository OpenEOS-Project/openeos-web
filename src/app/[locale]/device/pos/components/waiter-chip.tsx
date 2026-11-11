'use client';

import { useTranslations } from 'next-intl';
import { Dropdown, DropdownCaption, DropdownOption, DropdownSeparator, Icon } from '@openeos/ui';
import { textOn, waiterInitials, waiterLabel } from '@/lib/waiters';
import type { PosWaiter } from '@/types/waiter';

interface WaiterChipProps {
  waiter: PosWaiter;
  /** Gemeinsame Kasse: Wechseln, Sperren, Abmelden. Fest: nur Anzeige. */
  shared: boolean;
  onSwitch?: () => void;
  onLock?: () => void;
  onSignOut?: () => void;
  /** „Mein Zwischenstand“ (jede Bedienung). */
  onSummary?: () => void;
  /** „Abrechnen“ (Schichtleitung bzw. Admin). */
  onSettle?: () => void;
  /** „Live-Kassensturz“ (Schichtleitung bzw. Admin). */
  onLiveAudit?: () => void;
}

/** Kopf-Chip „Wer bedient?“ mit Farbe und Kurzname (bedienungen-plan.md §6). */
export function WaiterChip({ waiter, shared, onSwitch, onLock, onSignOut, onSummary, onSettle, onLiveAudit }: WaiterChipProps) {
  const t = useTranslations('pos.waiter');
  const label = waiterLabel(waiter);
  const color = waiter.color ?? 'var(--oe-ink)';
  const face = (
    <span className="pos-waiter" data-testid="pos-waiter-chip">
      <span className="pos-waiter__dot" style={{ background: color, color: textOn(waiter.color) }} aria-hidden>
        {waiterInitials(waiter.name)}
      </span>
      <span className="pos-waiter__name">{label}</span>
    </span>
  );
  const settlement = (
    <>
      {onSummary && (
        <DropdownOption icon={<Icon name="list" />} onClick={onSummary}>
          {t('summary')}
        </DropdownOption>
      )}
      {onSettle && (
        <DropdownOption icon={<Icon name="receipt" />} onClick={onSettle}>
          {t('settle')}
        </DropdownOption>
      )}
      {onLiveAudit && (
        <DropdownOption icon={<Icon name="cash" />} onClick={onLiveAudit}>
          {t('liveAudit')}
        </DropdownOption>
      )}
    </>
  );
  if (!shared) {
    if (!onSummary && !onSettle) {
      return (
        <span className="pos-head__user" title={t('fixed', { name: waiter.name })}>
          {face}
        </span>
      );
    }
    // Feste Bedienung: kein Wechseln/Sperren, aber Zwischenstand und Abrechnen.
    return (
      <div className="pos-head__user" title={t('fixed', { name: waiter.name })}>
        <Dropdown align="end" triggerVariant="quiet" trigger={<>{face}<span className="oe-sr-only">{t('menu', { name: waiter.name })}</span></>}>
          <DropdownCaption>{waiter.name}</DropdownCaption>
          {settlement}
        </Dropdown>
      </div>
    );
  }
  return (
    <div className="pos-head__user">
      <Dropdown align="end" triggerVariant="quiet" trigger={<>{face}<span className="oe-sr-only">{t('menu', { name: waiter.name })}</span></>}>
        <DropdownCaption>{waiter.name}</DropdownCaption>
        {settlement}
        {(onSummary || onSettle) && <DropdownSeparator />}
        <DropdownOption icon={<Icon name="users" />} onClick={onSwitch}>
          {t('switch')}
        </DropdownOption>
        <DropdownOption icon={<Icon name="lock" />} onClick={onLock}>
          {t('lock')}
        </DropdownOption>
        <DropdownSeparator />
        <DropdownOption icon={<Icon name="logout" />} onClick={onSignOut}>
          {t('signOut')}
        </DropdownOption>
      </Dropdown>
    </div>
  );
}
