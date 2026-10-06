'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@openeos/ui';
import { GripVertical } from 'lucide-react';

import { IconVisual } from '@/components/shared/product-image';
import type { Category } from '@/types/category';
import { categoryAccent, resolveCategoryIcon } from '@/utils/product-icon';

interface Props {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  editLabel: string;
  deleteLabel: string;
  statusLabel: string;
  dragLabel: string;
}

/**
 * Eine Zeile der Kategorienliste, verschiebbar.
 *
 * Gezogen wird nur am Griff, nicht an der ganzen Zeile. Sonst liesse sich
 * der Stift daneben kaum treffen: jeder Druck darauf begänne als
 * moegliche Verschiebung, und ein Klick, der um zwei Pixel wandert, waere
 * keiner mehr.
 */
export function CategorySortableRow({
  category,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  statusLabel,
  dragLabel,
}: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });

  return (
    <div
      ref={setNodeRef}
      className={`cat-row${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="cat-row__grip"
        aria-label={dragLabel}
        title={dragLabel}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>

      {/* Icon der Kategorie in ihrer Farbe — wie in der Kategorienliste
          und an Produkten ohne eigenes Bild. */}
      <IconVisual source={resolveCategoryIcon(category)} alt="" size="sm" accent={categoryAccent(category)} />

      <div className="cat-row__copy">
        <div className="cat-row__name">{category.name}</div>
        {category.description && <div className="cat-row__desc">{category.description}</div>}
      </div>

      {!category.isActive && <span className="badge badge--neutral">{statusLabel}</span>}

      <button
        type="button"
        className="btn btn--ghost btn--sm cat-row__action"
        onClick={() => onEdit(category)}
        aria-label={editLabel}
        title={editLabel}
      >
        <Icon name="edit" size={15} />
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm cat-row__action"
        onClick={() => onDelete(category)}
        aria-label={deleteLabel}
        title={deleteLabel}
        style={{ color: 'var(--danger)' }}
      >
        <Icon name="trash" size={15} />
      </button>
    </div>
  );
}
