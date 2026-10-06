'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Dropdown,
  DropdownCaption,
  DropdownOption,
  DropdownSeparator,
  Icon,
  StatusPill,
  UserChip,
  type IconName,
} from '@openeos/ui';
import type { PosConnectionState } from '@/hooks/use-pos-connection';
import type { PosTheme } from '@/stores/device-store';

export interface PosPrinterStatus {
  name: string;
  isOnline: boolean;
}

export interface PosMenuAction {
  id: string;
  icon: IconName;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface PosHeaderProps {
  deviceName: string;
  eventName: string | null;
  /**
   * Tisch-Pille nur in der Bestellansicht mit Tischbetrieb: Tisch, Theke
   * oder To-go (dann „Bestellung“ statt „Tisch“).
   */
  table: { kind: 'table' | 'counter' | 'togo'; label: string; onSwitch: () => void } | null;
  connection: PosConnectionState;
  /** Bondrucker des Geräts — nur gesetzt, wenn die API einen Zustand liefert. */
  printer: PosPrinterStatus | null;
  user: { firstName: string; lastName: string } | null;
  onLock?: () => void;
  menu: PosMenuAction[];
  /** Hell/Dunkel/System, je Gerät gespeichert. */
  theme: PosTheme;
  onThemeChange: (theme: PosTheme) => void;
  /** Abmelden steht getrennt am Ende des Menüs. */
  onLogout: () => void;
}

const THEMES: Array<{ id: PosTheme; icon: IconName }> = [
  { id: 'light', icon: 'sun' },
  { id: 'dark', icon: 'moon' },
  { id: 'system', icon: 'monitor' },
];

const CONNECTION_TONE: Record<PosConnectionState, 'default' | 'warn' | 'danger'> = {
  online: 'default',
  connecting: 'warn',
  limited: 'warn',
  offline: 'danger',
};

/** Kopfzeile der Kasse: Logo, Kontext, Tisch-Pille, Status, Mehr-Menü, Benutzer. */
export function PosHeader({
  deviceName,
  eventName,
  table,
  connection,
  printer,
  user,
  onLock,
  menu,
  theme,
  onThemeChange,
  onLogout,
}: PosHeaderProps) {
  const t = useTranslations('pos');

  const connectionLabel = t(`status.${connection}`);
  const printerProblem = printer && !printer.isOnline;

  return (
    <header className="pos-head">
      <span className="pos-head__brand">
        {/* Zwei Bilder, CSS wählt je Thema — kein Flackern beim Laden. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pos-logo pos-logo--dark" src="/logo_dark.png" alt={t('header.logoAlt')} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pos-logo pos-logo--light" src="/logo_light.png" alt="" aria-hidden />
      </span>
      <span className="pos-head__sep" aria-hidden />
      <div className="pos-head__ctx">
        <b>{deviceName}</b>
        <span>{eventName ?? t('header.noEvent')}</span>
      </div>

      {table && (
        <button
          type="button"
          className="pos-tablepill"
          onClick={table.onSwitch}
          aria-label={
            table.kind === 'table'
              ? t('header.tablePill', { label: table.label })
              : t('tables.pillOther', { label: table.label })
          }
        >
          <Icon name={table.kind === 'table' ? 'table' : table.kind === 'togo' ? 'send' : 'beer'} />
          <span className="pos-tablepill__txt">
            <small>{table.kind === 'table' ? t('header.tableCaption') : t('tables.pillCaptionOrder')}</small>
            <b>{table.label}</b>
          </span>
          <span className="pos-tablepill__sw">
            {t('header.switch')}
            <Icon name="chevron-down" size={14} />
          </span>
        </button>
      )}

      <span className="pos-head__grow" />

      <div className="pos-head__stat">
        <StatusPill
          className="pos-head__online"
          dot={connection === 'online' ? 'live' : connection === 'offline' ? 'danger' : 'warn'}
          icon={connection === 'offline' ? 'wifi-off' : undefined}
          tone={printerProblem && connection === 'online' ? 'warn' : CONNECTION_TONE[connection]}
          label={connectionLabel}
          title={connectionLabel}
        />
        {printer && (
          <StatusPill
            className="pos-hide-md"
            icon="printer"
            tone={printer.isOnline ? 'default' : 'danger'}
            label={
              printer.isOnline
                ? t('status.printer', { name: printer.name })
                : t('status.printerOffline', { name: printer.name })
            }
          />
        )}
        <PosClock />
      </div>

      <div className="pos-more">
        <Dropdown
          align="end"
          triggerVariant="quiet"
          trigger={
            <>
              <Icon name="menu" />
              <span className="oe-sr-only">{t('menu.label')}</span>
            </>
          }
        >
          {printer && (
            <DropdownOption
              className="pos-show-md"
              icon={<Icon name="printer" />}
              disabled
            >
              {printer.isOnline
                ? t('status.printer', { name: printer.name })
                : t('status.printerOffline', { name: printer.name })}
            </DropdownOption>
          )}
          {menu.map((action) => (
            <DropdownOption
              key={action.id}
              icon={<Icon name={action.icon} />}
              onClick={action.onSelect}
              disabled={action.disabled}
              danger={action.danger}
            >
              {action.label}
            </DropdownOption>
          ))}
          <DropdownSeparator />
          <DropdownCaption>{t('menu.theme')}</DropdownCaption>
          {THEMES.map((option) => (
            <DropdownOption
              key={option.id}
              icon={<Icon name={option.icon} />}
              selected={theme === option.id}
              onClick={() => onThemeChange(option.id)}
            >
              {t(`menu.theme_${option.id}`)}
            </DropdownOption>
          ))}
          <DropdownSeparator />
          <DropdownOption danger icon={<Icon name="logout" />} onClick={onLogout}>
            {t('menu.logout')}
          </DropdownOption>
        </Dropdown>
      </div>

      {user && (
        <UserChip
          className="pos-head__user"
          name={`${user.firstName} ${user.lastName.charAt(0)}.`.trim()}
          onLock={onLock}
          lockLabel={t('header.lock')}
        />
      )}
    </header>
  );
}

/** Uhrzeit im Kopf, alle 15 s aktualisiert. */
function PosClock() {
  const locale = useLocale();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const label = now
    ? now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : '';
  return <StatusPill className="pos-head__clock" icon="clock" label={label} />;
}
