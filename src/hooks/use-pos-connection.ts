'use client';

import { useEffect, useState } from 'react';

/**
 * Verbindungszustand der Kasse für Kopf und Sperren.
 *
 * - `online`      Socket verbunden
 * - `connecting`  Socket getrennt, Browser online, seit weniger als 30 s
 * - `limited`     Socket länger als 30 s getrennt, REST erreichbar
 *                 („Keine Live-Daten“ — Abfragen laufen weiter)
 * - `offline`     Browser meldet keine Verbindung
 *
 * Bewusst ohne Warteschlange: offline gehen Senden und Kassieren nicht.
 */
export type PosConnectionState = 'online' | 'connecting' | 'limited' | 'offline';

const LIMITED_AFTER_MS = 30_000;

export function usePosConnection(isSocketConnected: boolean): PosConnectionState {
  const [browserOnline, setBrowserOnline] = useState(true);
  const [disconnectedSince, setDisconnectedSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const update = () => setBrowserOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (isSocketConnected) {
      setDisconnectedSince(null);
      return;
    }
    setDisconnectedSince((since) => since ?? Date.now());
    // Nach Ablauf der Schwelle einmal neu bewerten.
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, [isSocketConnected]);

  if (!browserOnline) return 'offline';
  if (isSocketConnected) return 'online';
  if (disconnectedSince !== null && now - disconnectedSince > LIMITED_AFTER_MS) return 'limited';
  return 'connecting';
}
