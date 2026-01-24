'use client';

import { Calendar } from '@untitledui/icons';
import type { Event } from '@/types/event';

interface PosEventSelectorProps {
  events: Event[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}

export function PosEventSelector({
  events,
  selectedEventId,
  onSelectEvent,
}: PosEventSelectorProps) {
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-tertiary">
        <Calendar className="h-4 w-4" />
        <span>Kein Event</span>
      </div>
    );
  }

  if (events.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary">
        <Calendar className="h-4 w-4 text-tertiary" />
        <span>{events[0].name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-tertiary" />
      <select
        value={selectedEventId || ''}
        onChange={(e) => onSelectEvent(e.target.value)}
        className="rounded-lg border border-secondary bg-primary px-2 py-1 text-sm text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
      >
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name}
          </option>
        ))}
      </select>
    </div>
  );
}
