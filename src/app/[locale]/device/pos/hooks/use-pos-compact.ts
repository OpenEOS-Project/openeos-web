'use client';

import { useEffect, useState } from 'react';
import { breakpoints } from '@openeos/ui/tokens';

/** Kassen-Breakpoint „kompakt“ (≤ 820 px) — Telefon und Tablet hochkant. */
export function usePosCompact(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoints.posCompact}px)`);
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return compact;
}
