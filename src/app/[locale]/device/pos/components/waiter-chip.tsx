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
}

/** Kopf-Chip „Wer bedient?“ mit Farbe und Kurzname (bedienungen-plan.md §6). */
export function WaiterChip({ waiter, shared, onSwitch, onLock, onSignOut }: WaiterChipProps) {
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
  if (!shared) {
    return (
      <span className="pos-head__user" title={t('fixed', { name: waiter.name })}>
        {face}
      </span>
    );
  }
  return (
    <div className="pos-head__user">
      <Dropdown align="end" triggerVariant="quiet" trigger={<>{face}<span className="oe-sr-only">{t('menu', { name: waiter.name })}</span></>}>
        <DropdownCaption>{waiter.name}</DropdownCaption>
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
