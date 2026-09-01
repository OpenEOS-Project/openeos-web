'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { Category } from '@/types/category';

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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>

      <span
        className="cat-row__dot"
        style={{ background: category.color || 'var(--mute-2)' }}
        aria-hidden="true"
      />

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
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm cat-row__action"
        onClick={() => onDelete(category)}
        aria-label={deleteLabel}
        title={deleteLabel}
        style={{ color: 'var(--danger)' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" />
        </svg>
      </button>
    </div>
  );
}
