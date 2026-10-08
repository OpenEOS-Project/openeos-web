'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { patchAreasCache, saveTableLayout, tableKeys } from '@/hooks/use-tables';
import type { DiningTable, TableArea, TableAreaElement, TableLayoutItem, TablePoint } from '@/types/table';

/**
 * Autosave der Karte (Spezifikation §4.3).
 *
 * Änderungen an Lage, Größe, Drehung und Form landen sofort als Entwurf
 * über den Serverdaten (optimistisch) und gehen 600 ms nach der letzten
 * Änderung gesammelt per `PUT …/layout` raus — nur die geänderten Tische,
 * Deko (Rechtecke, Wände, Zonen) und Umriss nur, wenn sie sich geändert
 * haben. Je Bereich läuft immer nur ein
 * Speichervorgang; was währenddessen dazukommt, folgt danach.
 * Schlägt das Speichern fehl, verschwindet der Entwurf (Rücksprung auf den
 * Serverstand) und `onError` zeigt den Grund.
 */

export type LayoutFields = Pick<DiningTable, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'shape'>;
export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

interface Draft {
  tables: Map<string, Partial<LayoutFields>>;
  decor: TableAreaElement[] | null;
  /** `undefined` = unverändert, `null` = zurück auf die ganze Karte. */
  outline?: TablePoint[] | null;
}

function draftIn(drafts: Map<string, Draft>, areaId: string): Draft {
  let draft = drafts.get(areaId);
  if (!draft) {
    draft = { tables: new Map(), decor: null, outline: undefined };
    drafts.set(areaId, draft);
  }
  return draft;
}
const DEBOUNCE_MS = 600;

export function useLayoutDraft(organizationId: string, onError: (error: unknown) => void) {
  const queryClient = useQueryClient();
  const key = tableKeys.areas(organizationId);

  /* Zwei Ebenen je Bereich: `pending` wartet auf den Timer, `inflight`
     ist gerade unterwegs. Angezeigt wird Server ← inflight ← pending. */
  const pending = useRef(new Map<string, Draft>());
  const inflight = useRef(new Map<string, Draft>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const chains = useRef(new Map<string, Promise<void>>());
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<SaveState>('saved');
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const bump = () => setRevision((r) => r + 1);

  const refreshState = useCallback(() => {
    const busy = inflight.current.size > 0;
    const waiting = pending.current.size > 0;
    setState((prev) => (busy ? 'saving' : waiting ? 'pending' : prev === 'error' ? 'error' : 'saved'));
  }, []);

  const flush = useCallback(
    (areaId: string): Promise<void> => {
      clearTimeout(timers.current.get(areaId));
      timers.current.delete(areaId);
      const draft = pending.current.get(areaId);
      if (!draft) return chains.current.get(areaId) ?? Promise.resolve();

      const previous = chains.current.get(areaId) ?? Promise.resolve();
      const run = previous.then(async () => {
        // Erst jetzt aus `pending` nehmen: was bis hierhin dazukam, geht mit.
        const current = pending.current.get(areaId);
        if (!current) return;
        pending.current.delete(areaId);
        inflight.current.set(areaId, current);
        setState('saving');

        const area = queryClient.getQueryData<TableArea[]>(key)?.find((a) => a.id === areaId);
        const tables: TableLayoutItem[] = [];
        for (const [id, fields] of current.tables) {
          const base = area?.tables.find((t) => t.id === id);
          if (!base) continue;
          const merged = { ...base, ...fields };
          tables.push({
            id,
            x: merged.x,
            y: merged.y,
            width: merged.width,
            height: merged.height,
            rotation: merged.rotation,
            shape: merged.shape,
          });
        }

        try {
          const saved = await saveTableLayout(organizationId, areaId, {
            tables,
            ...(current.decor ? { decor: current.decor } : {}),
            ...(current.outline !== undefined ? { outline: current.outline } : {}),
          });
          queryClient.setQueryData<TableArea[]>(key, (areas) =>
            patchAreasCache(
              areas,
              (a) => ({
                ...a,
                decor: saved.decor ?? a.decor,
                outline: saved.outline !== undefined ? saved.outline : a.outline,
                tables: a.tables.map((t) => saved.tables?.find((s) => s.id === t.id) ?? t),
              }),
              areaId,
            ),
          );
          inflight.current.delete(areaId);
          setState(inflight.current.size || pending.current.size ? 'saving' : 'saved');
        } catch (error) {
          inflight.current.delete(areaId);
          // Rücksprung: auch was danach kam, baut auf dem verworfenen Stand auf.
          pending.current.delete(areaId);
          clearTimeout(timers.current.get(areaId));
          timers.current.delete(areaId);
          setState('error');
          onErrorRef.current(error);
          queryClient.invalidateQueries({ queryKey: key });
        } finally {
          bump();
        }
      });
      chains.current.set(areaId, run);
      return run;
    },
    // key ist aus organizationId abgeleitet
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, queryClient],
  );

  const schedule = useCallback(
    (areaId: string) => {
      clearTimeout(timers.current.get(areaId));
      timers.current.set(
        areaId,
        setTimeout(() => flush(areaId), DEBOUNCE_MS),
      );
      bump();
      refreshState();
    },
    [flush, refreshState],
  );

  /** Lage/Größe/Drehung/Form eines Tisches ändern. */
  const changeTable = useCallback(
    (areaId: string, tableId: string, fields: Partial<LayoutFields>) => {
      const draft = draftIn(pending.current, areaId);
      draft.tables.set(tableId, { ...draft.tables.get(tableId), ...fields });
      schedule(areaId);
    },
    [schedule],
  );

  /** Deko des Bereichs ersetzen (Hinzufügen, Verschieben, Löschen; auch Wände und Zonen). */
  const changeDecor = useCallback(
    (areaId: string, decor: TableAreaElement[]) => {
      draftIn(pending.current, areaId).decor = decor;
      schedule(areaId);
    },
    [schedule],
  );

  /** Umriss des Bereichs setzen; `null` = ganze Karte. */
  const changeOutline = useCallback(
    (areaId: string, outline: TablePoint[] | null) => {
      draftIn(pending.current, areaId).outline = outline;
      schedule(areaId);
    },
    [schedule],
  );

  /** Bereich mit allen offenen Entwürfen, so wie er gerade aussehen soll. */
  const apply = useCallback(
    (area: TableArea): TableArea => {
      const layers = [inflight.current.get(area.id), pending.current.get(area.id)].filter(Boolean) as Draft[];
      if (layers.length === 0) return area;
      let { tables, decor } = area;
      let outline = area.outline ?? null;
      for (const layer of layers) {
        if (layer.tables.size) {
          tables = tables.map((t) => {
            const fields = layer.tables.get(t.id);
            return fields ? { ...t, ...fields } : t;
          });
        }
        if (layer.decor) decor = layer.decor;
        if (layer.outline !== undefined) outline = layer.outline;
      }
      return { ...area, tables, decor, outline };
    },
    // revision: neu berechnen, sobald sich ein Entwurf ändert
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision],
  );

  const flushAll = useCallback(() => {
    for (const areaId of [...pending.current.keys()]) flush(areaId);
  }, [flush]);

  const isBusy = useCallback(() => pending.current.size > 0 || inflight.current.size > 0, []);

  /* Beim Verlassen der Seite nichts liegen lassen; das Schließen des
     Tabs mit ungespeicherten Änderungen fragt nach. */
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isBusy()) return;
      flushAll();
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      flushAll();
    };
  }, [flushAll, isBusy]);

  return useMemo(
    () => ({ apply, changeTable, changeDecor, changeOutline, flush, flushAll, isBusy, state }),
    [apply, changeTable, changeDecor, changeOutline, flush, flushAll, isBusy, state],
  );
}
