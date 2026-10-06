'use client';

import { useTranslations } from 'next-intl';
import { Legend, TableChip, TableGrid } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import { toTableKey, type DeviceDiningTable, type DeviceTableArea } from '@/types/table';
import type { OpenTableEntry } from '../utils/tables';

interface TableListProps {
  /** Bereiche in Anzeigereihenfolge (Standardbereich zuerst). */
  areas: DeviceTableArea[];
  /** Offene/wartende Tische nach Tischschlüssel. */
  states: Map<string, OpenTableEntry>;
  /** Aktuell geöffneter Tisch (Tisch-wählen-Blatt). */
  currentKey?: string | null;
  onPick: (table: DeviceDiningTable) => void;
  /** `lg` auf der Startansicht, `md` im Blatt. */
  size?: 'md' | 'lg';
}

/**
 * Tische je Bereich als Chips mit Zustand (frei / offen / wartet) und
 * Betrag, darunter die Legende. Startansicht „Tische“ und Tisch-wählen-Blatt.
 */
export function TableList({ areas, states, currentKey, onPick, size = 'lg' }: TableListProps) {
  const t = useTranslations('pos.tables');
  const formatPrice = useFormatPrice();

  return (
    <div className="pos-tablelist">
      {areas
        .filter((area) => area.tables.length > 0)
        .map((area) => (
          <section key={area.id} className="pos-tablelist__area" aria-label={area.name}>
            <span className="oe-label">{area.name}</span>
            <TableGrid min={size === 'lg' ? 104 : 84}>
              {area.tables.map((table) => {
                const key = toTableKey(table.label);
                const entry = states.get(key);
                const current = key === currentKey;
                const hint = current
                  ? t('hintCurrent')
                  : entry?.state === 'wait'
                    ? t('hintWait')
                    : entry
                      ? entry.amount > 0
                        ? formatPrice(entry.amount)
                        : t('hintOpen')
                      : t('hintFree');
                return (
                  <TableChip
                    key={table.id}
                    size={size}
                    label={table.label}
                    hint={hint}
                    state={entry?.state ?? 'free'}
                    current={current}
                    aria-label={t('chipAria', { label: table.label, hint })}
                    onClick={() => onPick(table)}
                  />
                );
              })}
            </TableGrid>
          </section>
        ))}
      <Legend
        items={[
          { tone: 'free', label: t('legendFree') },
          { tone: 'busy', label: t('legendBusy') },
          { tone: 'wait', label: t('legendWait') },
        ]}
      />
    </div>
  );
}
