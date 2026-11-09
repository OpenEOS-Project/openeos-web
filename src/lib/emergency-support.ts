import { currentEventPhase } from '@/lib/event-phase';
import type { Event } from '@/types/event';
import type { EmergencySupportInfo } from '@/types/support';

/**
 * Wo der Notfall-Support (AGB 18.2) erscheint. Ob es ihn überhaupt gibt,
 * entscheidet die API (Rufnummer hinterlegt, Organisation mit gebuchter,
 * noch nicht beendeter Veranstaltung) — hier nur noch, an welcher Stelle.
 */
type PhaseEvent = Pick<Event, 'id' | 'status' | 'phase' | 'realSalesFrom' | 'realSalesUntil'>;

/** Support-Bereich: immer, wenn die API eine Nummer liefert. */
export function emergencyPhoneFor(info: EmergencySupportInfo | null | undefined): EmergencySupportInfo | null {
  return info?.phone && info.telUri ? info : null;
}

/**
 * Dashboard und Veranstaltungen: nur solange eine der gebuchten
 * Veranstaltungen „Geplant“ oder „Aktiv“ ist (nicht mehr nach dem Ende).
 */
export function showEmergencyForEvents(
  info: EmergencySupportInfo | null | undefined,
  events: PhaseEvent[] | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!emergencyPhoneFor(info) || !events?.length) return false;
  const ids = new Set(info!.eventIds);
  return events.some((event) => {
    if (!ids.has(event.id)) return false;
    const phase = currentEventPhase(event, now);
    return phase === 'planned' || phase === 'active';
  });
}

/** Kasse: nur während die Veranstaltung der Kasse echt verkauft („Aktiv“). */
export function showEmergencyAtPos(
  info: EmergencySupportInfo | null | undefined,
  event: PhaseEvent | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!emergencyPhoneFor(info) || !event) return false;
  return info!.eventIds.includes(event.id) && currentEventPhase(event, now) === 'active';
}
