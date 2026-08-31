'use client';

import { useCallback, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsGrid, X } from '@untitledui/icons';

import { GRID_COLUMNS, MAX_HEIGHT, MIN_WIDTH, clamp } from './widgets/widget-sizing';

interface Props {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Griffe und Rahmen erscheinen nur im Bearbeitungsmodus. */
  editing: boolean;
  onResize: (size: { w: number; h: number }) => void;
  onRemove: () => void;
  children: React.ReactNode;
}

/**
 * Hülle einer Dashboard-Kachel.
 *
 * Trägt Ziehgriff, Größenanfasser und Entfernen-Knopf, damit die
 * Widgets selbst nichts davon wissen müssen — sie rendern weiter nur
 * ihren Inhalt.
 *
 * Die Griffe erscheinen erst im Bearbeitungsmodus. Sonst würde jeder
 * Zieh-Versuch beim Scrollen die Anordnung verschieben, und ein
 * Schließkreuz an jeder Kachel lädt zum versehentlichen Entfernen ein.
 */
export function DashboardTile({
  id,
  label,
  width,
  height,
  editing,
  onResize,
  onRemove,
  children,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editing });

  const tileRef = useRef<HTMLDivElement | null>(null);

  /**
   * Größe ziehen. Gerechnet wird in Rasterschritten, nicht in Pixeln:
   * die Kachel rastet dadurch ein, statt beliebige Zwischengrößen
   * anzunehmen, die beim nächsten Umbruch krumm stünden.
   */
  const startResize = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const tile = tileRef.current;
      const grid = tile?.parentElement;
      if (!tile || !grid) return;

      const gridStyle = getComputedStyle(grid);
      const gap = parseFloat(gridStyle.columnGap) || 0;
      const columnWidth = (grid.clientWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
      const rowHeight = parseFloat(gridStyle.gridAutoRows) || 120;

      const startX = event.clientX;
      const startY = event.clientY;
      const startW = width;
      const startH = height;

      const move = (e: PointerEvent) => {
        const dw = Math.round((e.clientX - startX) / (columnWidth + gap));
        const dh = Math.round((e.clientY - startY) / (rowHeight + gap));
        onResize({
          w: clamp(startW + dw, MIN_WIDTH, GRID_COLUMNS),
          h: clamp(startH + dh, 1, MAX_HEIGHT),
        });
      };
      const stop = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', stop);
    },
    [width, height, onResize],
  );

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        tileRef.current = node;
      }}
      className={`dash-tile${editing ? ' dash-tile--editing' : ''}${isDragging ? ' dash-tile--dragging' : ''}`}
      style={{
        gridColumn: `span ${width}`,
        gridRow: `span ${height}`,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
    >
      {editing && (
        /* Ueberlagerung statt Kopfzeile: eine Leiste im Fluss haette
           Hoehe gekostet, und die Kennzahlkacheln haetten dadurch im
           Bearbeitungsmodus gescrollt. Der Titel steht bewusst nicht
           darin — die Karte darunter nennt ihn bereits. */
        <div className="dash-tile__bar">
          <button
            type="button"
            className="dash-tile__grip"
            aria-label={`${label} verschieben`}
            {...attributes}
            {...listeners}
          >
            <DotsGrid />
          </button>
          <span className="dash-tile__size" aria-label={`${label}: ${width} mal ${height}`}>
            {width}×{height}
          </span>
          <button
            type="button"
            className="dash-tile__remove"
            onClick={onRemove}
            aria-label={`${label} entfernen`}
          >
            <X />
          </button>
        </div>
      )}

      <div className="dash-tile__body">{children}</div>

      {editing && (
        <span
          className="dash-tile__resize"
          role="slider"
          tabIndex={0}
          aria-label={`${label} Größe ändern`}
          aria-valuenow={width}
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={GRID_COLUMNS}
          onPointerDown={startResize}
          onKeyDown={(e) => {
            /* Ohne Tastatur waere die Groesse nur mit Maus erreichbar. */
            if (e.key === 'ArrowRight') onResize({ w: clamp(width + 1, MIN_WIDTH, GRID_COLUMNS), h: height });
            if (e.key === 'ArrowLeft') onResize({ w: clamp(width - 1, MIN_WIDTH, GRID_COLUMNS), h: height });
            if (e.key === 'ArrowDown') onResize({ w: width, h: clamp(height + 1, 1, MAX_HEIGHT) });
            if (e.key === 'ArrowUp') onResize({ w: width, h: clamp(height - 1, 1, MAX_HEIGHT) });
          }}
        />
      )}
    </div>
  );
}
