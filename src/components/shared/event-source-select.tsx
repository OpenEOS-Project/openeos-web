'use client';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import type { Event } from '@/types';

interface EventSourceSelectProps {
  /** Schon sortiert (eventsByStart). */
  events: Event[];
  value: string;
  onChange: (eventId: string) => void;
  label: string;
  /** Zusätzlicher Eintrag mit leerem Wert („Nichts übernehmen“). */
  noneLabel?: string;
  className?: string;
}

/** Auswahl einer Vorlage: Name und Beginn. */
export function EventSourceSelect({ events, value, onChange, label, noneLabel, className }: EventSourceSelectProps) {
  const { formatDate } = useLocaleFormat();
  return (
    <select
      className={className ? `select ${className}` : 'select'}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {events.map((event) => (
        <option key={event.id} value={event.id}>
          {event.startDate ? `${event.name} (${formatDate(event.startDate)})` : event.name}
        </option>
      ))}
      {noneLabel !== undefined && <option value="">{noneLabel}</option>}
    </select>
  );
}
