'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';

import type { DashboardWidgetSize } from '@/types/settings';
import { DashboardTile } from './dashboard-tile';
import type { WidgetDefinition } from './widgets/widget-registry';
import { sizeFor, withSize } from './widgets/widget-sizing';

interface Props {
  widgets: WidgetDefinition[];
  sizes: DashboardWidgetSize[] | undefined;
  organizationId: string;
  editing: boolean;
  onOrderChange: (ids: string[]) => void;
  onSizesChange: (sizes: DashboardWidgetSize[]) => void;
  onRemove: (id: string) => void;
}

/**
 * Dashboard als Raster.
 *
 * Die Kacheln lagen zuvor als volle Breite untereinander — vier
 * Kennzahlen brauchten damit vier Bildschirmhöhen. Jetzt teilen sie
 * sich zwölf Spalten und lassen sich anordnen und in der Größe ändern.
 */
export function DashboardGrid({
  widgets,
  sizes,
  organizationId,
  editing,
  onOrderChange,
  onSizesChange,
  onRemove,
}: Props) {
  const t = useTranslations('dashboard');

  const sensors = useSensors(
    // Erst ab acht Pixeln greift das Ziehen — sonst wird jeder Klick
    // auf den Griff schon als Verschiebung gewertet.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = widgets.map((w) => w.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onOrderChange(arrayMove(ids, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div className="dash-grid">
          {widgets.map((widget) => {
            const size = sizeFor(widget, sizes);
            return (
              <DashboardTile
                key={widget.id}
                id={widget.id}
                label={t(widget.labelKey)}
                width={size.w}
                height={size.h}
                editing={editing}
                onResize={(next) => onSizesChange(withSize(sizes, widget.id, next))}
                onRemove={() => onRemove(widget.id)}
              >
                <widget.Component organizationId={organizationId} />
              </DashboardTile>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
