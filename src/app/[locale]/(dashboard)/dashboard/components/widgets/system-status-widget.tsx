'use client';

import { useTranslations } from 'next-intl';

import { useSystemStatus } from '@/hooks/use-reports';

interface Props {
  organizationId: string;
}

type Tone = 'live' | 'warn' | 'danger' | 'idle';

interface Tile {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}

/**
 * Statusleiste: laeuft der Betrieb gerade?
 *
 * Aus der Designvorlage uebernommen, dort mit einer TSE-Kachel. OpenEOS
 * hat keine TSE — an ihrer Stelle stehen die offenen Bestellungen, damit
 * die Leiste durchgehend echte Zahlen zeigt und keine erfundene.
 *
 * Der Punkt links traegt die Aussage: gruen pulsierend heisst verbunden,
 * gelb heisst unvollstaendig, rot heisst nichts erreichbar. Farbe allein
 * genuegt nicht, deshalb steht die Zahl immer daneben.
 */
export function SystemStatusWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard.widgets.systemStatus');
  const { data, isLoading } = useSystemStatus(organizationId);

  if (isLoading || !data) {
    return (
      <div className="app-sys" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <span className="oe-label">&nbsp;</span>
            <span className="app-sys__value">
              <span className="oe-skel" style={{ width: 84, height: 14 }} />
            </span>
            <span className="oe-small">&nbsp;</span>
          </div>
        ))}
      </div>
    );
  }

  /** Kein Geraet eingerichtet ist kein Fehler, sondern schlicht leer. */
  const reach = (online: number, total: number): Tone => {
    if (total === 0) return 'idle';
    if (online === 0) return 'danger';
    return online < total ? 'warn' : 'live';
  };

  /** "0 / 1 verbunden" waere irrefuehrend — der Hinweis muss den
      tatsaechlichen Zustand benennen, nicht die Ueberschrift wiederholen. */
  const reachHint = (online: number, total: number): string => {
    if (total === 0) return t('noneConfigured');
    if (online === 0) return t('unreachable');
    if (online < total) return t('partiallyReachable');
    return t('allConnected');
  };

  const tiles: Tile[] = [
    {
      label: t('pos'),
      value: `${data.pos.online} / ${data.pos.total}`,
      hint: reachHint(data.pos.online, data.pos.total),
      tone: reach(data.pos.online, data.pos.total),
    },
    {
      label: t('printers'),
      value: `${data.printers.online} / ${data.printers.total}`,
      hint: reachHint(data.printers.online, data.printers.total),
      tone: reach(data.printers.online, data.printers.total),
    },
    {
      label: t('printQueue'),
      value: t('jobs', { count: data.printQueue.queued }),
      hint: t('throughput', { count: data.printQueue.completedLastHour }),
      tone: data.printQueue.queued > 10 ? 'warn' : 'live',
    },
    {
      label: t('openOrders'),
      value: String(data.openOrders),
      hint: t('openOrdersHint'),
      tone: data.openOrders > 0 ? 'warn' : 'live',
    },
  ];

  return (
    <div className="app-sys">
      {tiles.map((tile) => (
        <div key={tile.label}>
          <span className="oe-label">{tile.label}</span>
          <span className="app-sys__value">
            <span
              className={
                tile.tone === 'idle' ? 'oe-dot' : `oe-dot oe-dot--${tile.tone}`
              }
            />
            {tile.value}
          </span>
          <span className="oe-small">{tile.hint}</span>
        </div>
      ))}
    </div>
  );
}
