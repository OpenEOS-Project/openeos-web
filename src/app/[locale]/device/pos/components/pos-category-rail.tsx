'use client';

import type { Category } from '@/types/category';

interface PosCategoryRailProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
  /** 'vertical' = desktop sidebar, 'horizontal' = mobile/tablet pills */
  orientation?: 'vertical' | 'horizontal';
}

/**
 * POS category selector — two orientations:
 *   vertical  → left sidebar with icon + label + product count
 *   horizontal → scrollable pill row for mobile/tablet
 */
export function PosCategoryRail({
  categories,
  selectedCategoryId,
  onSelectCategory,
  orientation = 'vertical',
}: PosCategoryRailProps) {
  const active = categories
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (orientation === 'horizontal') {
    return (
      <div
        className="pos-scroll"
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '10px 14px',
          WebkitOverflowScrolling: 'touch',
          borderBottom: '1px solid var(--pos-line)',
          background: 'var(--pos-surface)',
        }}
      >
        {active.map((c) => {
          const on = c.id === selectedCategoryId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCategory(c.id)}
              style={{
                flex: '0 0 auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 13px',
                background: on ? 'var(--pos-accent)' : 'var(--pos-surface)',
                color: on ? 'var(--pos-accent-contrast)' : 'var(--pos-ink)',
                border: `1px solid ${on ? 'var(--pos-accent)' : 'var(--pos-line)'}`,
                borderRadius: 999,
                fontSize: 13,
                fontWeight: on ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background .12s, color .12s, border-color .12s',
              }}
            >
              {c.icon && (
                <span style={{ fontSize: 16, lineHeight: 1 }}>{c.icon}</span>
              )}
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Vertical sidebar
  return (
    <aside
      style={{
        background: 'var(--pos-surface-2)',
        borderRight: '1px solid var(--pos-line)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '14px 16px 8px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--pos-ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Kategorien
      </div>
      <div
        className="pos-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}
      >
        {active.map((c) => {
          const on = c.id === selectedCategoryId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCategory(c.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 12px',
                marginBottom: 3,
                border: 'none',
                background: on ? 'var(--pos-accent)' : 'transparent',
                color: on ? 'var(--pos-accent-contrast)' : 'var(--pos-ink)',
                borderRadius: 'var(--pos-r-sm)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 14,
                fontWeight: on ? 600 : 500,
                transition: 'background .12s',
              }}
              onMouseEnter={(e) => {
                if (!on) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,.04)';
              }}
              onMouseLeave={(e) => {
                if (!on) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, textAlign: 'center' }}>
                {c.icon || '🍽️'}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span>{c.name}</span>
                {c.description && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: on ? 'rgba(255,255,255,.75)' : 'var(--pos-ink-3)',
                      marginTop: 1,
                    }}
                  >
                    {c.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
