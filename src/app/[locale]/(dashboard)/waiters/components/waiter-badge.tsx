'use client';

import { textOn, waiterInitials } from '@/lib/waiters';

/** Farbiger Kreis mit Initialen (Liste, PIN-Zettel). */
export function WaiterBadge({ name, color, size = 32 }: { name: string; color: string | null; size?: number }) {
  return (
    <span
      aria-hidden
      className="waiter-badge"
      style={{
        width: size,
        height: size,
        background: color ?? 'var(--ink)',
        color: textOn(color),
        fontSize: Math.round(size * 0.36),
      }}
    >
      {waiterInitials(name)}
    </span>
  );
}
