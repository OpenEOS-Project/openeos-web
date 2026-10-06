'use client';

import { useRef, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Dropdown, DropdownOption, DropdownSeparator, Icon } from '@openeos/ui';

import type { TableArea } from '@/types/table';

interface AreaTabsProps {
  areas: TableArea[];
  activeId: string | null;
  onSelect: (areaId: string) => void;
  onAdd: () => void;
  onEdit: (area: TableArea) => void;
  onMove: (area: TableArea, direction: -1 | 1) => void;
  onDelete: (area: TableArea) => void;
}

/**
 * Bereiche als Reiter. Das Menü neben dem aktiven Reiter benennt um,
 * ändert die Größe der Karte, sortiert und löscht.
 */
export function AreaTabs({ areas, activeId, onSelect, onAdd, onEdit, onMove, onDelete }: AreaTabsProps) {
  const t = useTranslations('tables.areas');
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = areas.findIndex((a) => a.id === activeId);
  const active = activeIndex >= 0 ? areas[activeIndex] : null;

  // Pfeiltasten wechseln den Reiter (WAI-ARIA Tabs).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step || areas.length < 2) return;
    event.preventDefault();
    const next = areas[(activeIndex + step + areas.length) % areas.length];
    onSelect(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-area="${next.id}"]`)?.focus();
  };

  return (
    <div className="tables-areas">
      <div className="oe-tabs tables-areas__tabs" role="tablist" aria-label={t('tablist')} ref={listRef} onKeyDown={onKeyDown}>
        {areas.map((area) => {
          const selected = area.id === activeId;
          return (
            <button
              key={area.id}
              type="button"
              role="tab"
              data-area={area.id}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={selected ? 'oe-tab is-active' : 'oe-tab'}
              onClick={() => onSelect(area.id)}
            >
              {area.name}
              <span className="oe-tab__count">{area.tables.length}</span>
            </button>
          );
        })}
      </div>

      {active && (
        /* Linksbündig am Auslöser: das Menü sitzt neben den Reitern am
           linken Rand des Inhaltsbereichs, rechtsbündig ragte es darüber
           hinaus. Reicht der Platz nicht, schiebt @openeos/ui es zurück. */
        <Dropdown
          triggerVariant="quiet"
          triggerSize="sm"
          className="tables-areas__menu"
          trigger={
            <>
              <Icon name="more" />
              <span className="oe-sr-only">{t('menu', { name: active.name })}</span>
            </>
          }
        >
          <DropdownOption icon={<Icon name="edit" />} onClick={() => onEdit(active)}>
            {t('edit')}
          </DropdownOption>
          <DropdownOption
            icon={<Icon name="chevron-left" />}
            disabled={activeIndex <= 0}
            onClick={() => onMove(active, -1)}
          >
            {t('moveLeft')}
          </DropdownOption>
          <DropdownOption
            icon={<Icon name="chevron-right" />}
            disabled={activeIndex >= areas.length - 1}
            onClick={() => onMove(active, 1)}
          >
            {t('moveRight')}
          </DropdownOption>
          <DropdownSeparator />
          <DropdownOption danger icon={<Icon name="trash" />} onClick={() => onDelete(active)}>
            {t('delete')}
          </DropdownOption>
        </Dropdown>
      )}

      <Button variant="ghost" size="sm" onClick={onAdd} className="tables-areas__add">
        <Icon name="plus" />
        {t('add')}
      </Button>
    </div>
  );
}
