'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { Icon, Toast } from '@openeos/ui';

/**
 * Kurze Rückmeldungen der Kasse („3 Artikel an Küche & Theke gesendet“,
 * Fehler aus der API). Unten mittig, über der Warenkorb-Leiste;
 * Erfolg verschwindet nach 2,4 s, Fehler bleiben 6 s stehen.
 */
export type PosToastTone = 'success' | 'danger';

interface PosToastItem {
  id: number;
  tone: PosToastTone;
  text: string;
}

type ShowToast = (text: string, tone?: PosToastTone) => void;

const PosToastContext = createContext<ShowToast>(() => {});

export function usePosToast() {
  return useContext(PosToastContext);
}

export function PosToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('deviceUi.common');
  const [items, setItems] = useState<PosToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback<ShowToast>(
    (text, tone = 'success') => {
      const id = ++seq.current;
      // Ein Erfolgshinweis ersetzt den vorigen (schnelles Tippen soll
      // keinen Stapel erzeugen); Fehler bleiben stehen, höchstens drei.
      setItems((prev) => [
        ...prev.filter((item) => item.tone === 'danger').slice(-2),
        { id, tone, text },
      ]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), tone === 'danger' ? 6000 : 2400));
    },
    [dismiss],
  );

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <PosToastContext.Provider value={value}>
      {children}
      <div className="pos-toastzone" aria-live="polite">
        {items.map((item) => (
          <Toast
            key={item.id}
            tone={item.tone}
            onDismiss={() => dismiss(item.id)}
            dismissLabel={t('dismiss')}
            title={
              <>
                <Icon name={item.tone === 'danger' ? 'alert' : 'check-circle'} />
                {item.text}
              </>
            }
          />
        ))}
      </div>
    </PosToastContext.Provider>
  );
}
