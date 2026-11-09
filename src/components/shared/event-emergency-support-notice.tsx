'use client';

import { useEffect, useState } from 'react';

import { useEvents } from '@/hooks/use-events';
import { useEmergencySupport } from '@/hooks/use-support';
import { showEmergencyForEvents } from '@/lib/emergency-support';
import type { Event } from '@/types';

import { EmergencySupportNotice } from './emergency-support-notice';

/**
 * Notfall-Support im Dashboard und bei den Veranstaltungen: nur solange
 * eine gebuchte Veranstaltung „Geplant“ oder „Aktiv“ ist. `events` kann
 * die Liste übergeben, die die Seite ohnehin geladen hat.
 */
export function EventEmergencySupportNotice({
  organizationId,
  events,
  wrapperClassName,
}: {
  organizationId: string;
  events?: Event[];
  /** Eigener Rahmen (z. B. Abstand in einer Karte), nur wenn sichtbar. */
  wrapperClassName?: string;
}) {
  const { data: info } = useEmergencySupport(organizationId);
  const { data: loaded } = useEvents(events ? '' : organizationId);
  // Phasen wechseln mit der Uhr (Ende + Kulanz): jede Minute neu bewerten.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (!info || !showEmergencyForEvents(info, events ?? loaded, now)) return null;
  const notice = <EmergencySupportNotice info={info} />;
  return wrapperClassName ? <div className={wrapperClassName}>{notice}</div> : notice;
}
