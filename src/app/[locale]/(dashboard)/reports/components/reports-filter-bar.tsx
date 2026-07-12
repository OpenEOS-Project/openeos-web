'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import type { Event } from '@/types/event';

export type TimeRange = 'today' | 'yesterday' | 'all' | 'custom';

export interface ReportsFilter {
  eventId: string;
  timeRange: TimeRange;
  startDate: string;
  endDate: string;
}

interface ReportsFilterBarProps {
  filter: ReportsFilter;
  events: Event[];
  eventsLoading: boolean;
  onChange: (filter: ReportsFilter) => void;
  actions?: ReactNode;
}

export function ReportsFilterBar({ filter, events, eventsLoading, onChange, actions }: ReportsFilterBarProps) {
  const t = useTranslations('reports');

  const setTimeRange = (range: TimeRange) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (range === 'today') {
      onChange({
        ...filter,
        timeRange: 'today',
        startDate: todayStr,
        endDate: `${todayStr}T23:59:59`,
      });
    } else if (range === 'yesterday') {
      onChange({
        ...filter,
        timeRange: 'yesterday',
        startDate: yesterdayStr,
        endDate: `${yesterdayStr}T23:59:59`,
      });
    } else if (range === 'all') {
      onChange({
        ...filter,
        timeRange: 'all',
        startDate: '',
        endDate: '',
      });
    }
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const updated = { ...filter, timeRange: 'custom' as TimeRange };
    if (field === 'endDate' && value) {
      updated.endDate = `${value}T23:59:59`;
    } else {
      updated[field] = value;
    }
    onChange(updated);
  };

  const getEndDateValue = () => {
    if (!filter.endDate) return '';
    return filter.endDate.split('T')[0];
  };

  const quickRanges: { key: TimeRange; label: string }[] = [
    { key: 'today', label: t('filter.today') },
    { key: 'yesterday', label: t('filter.yesterday') },
    { key: 'all', label: t('filter.all') },
  ];

  return (
    <div className="app-card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        {/* Event filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('filter.event')}
          </label>
          <select
            className="input"
            style={{ minWidth: 200, padding: '7px 10px', fontSize: 13 }}
            value={filter.eventId}
            onChange={(e) => onChange({ ...filter, eventId: e.target.value })}
            disabled={eventsLoading}
          >
            <option value="">{t('filter.allEvents')}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
                {event.status === 'active' ? ` (${t('filter.active')})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Quick range buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('filter.timeRange')}
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {quickRanges.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={filter.timeRange === key ? 'btn btn--primary' : 'btn btn--ghost'}
                style={{ fontSize: 13, padding: '7px 12px' }}
                onClick={() => setTimeRange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('filter.from')}
          </label>
          <input
            type="date"
            className="input"
            style={{ padding: '7px 10px', fontSize: 13 }}
            value={filter.startDate.split('T')[0]}
            onChange={(e) => handleDateChange('startDate', e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('filter.to')}
          </label>
          <input
            type="date"
            className="input"
            style={{ padding: '7px 10px', fontSize: 13 }}
            value={getEndDateValue()}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
          />
        </div>

        {actions ? <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>{actions}</div> : null}
      </div>
    </div>
  );
}
