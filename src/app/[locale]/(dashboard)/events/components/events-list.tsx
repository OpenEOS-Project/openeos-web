'use client';

import { useTranslations } from 'next-intl';
import { Calendar, Edit01, Play, Plus, XClose, Square, Trash01 } from '@untitledui/icons';

import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Table, TableCard } from '@/components/ui/table/table';
import { useEvents } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { Event, EventStatus } from '@/types';

interface EventsListProps {
  onCreateClick: () => void;
  onEditClick: (event: Event) => void;
  onDeleteClick: (event: Event) => void;
  onActivateClick: (event: Event) => void;
  onCompleteClick: (event: Event) => void;
  onCancelClick: (event: Event) => void;
}

const statusColorMap: Record<EventStatus, 'gray' | 'success' | 'brand' | 'error'> = {
  draft: 'gray',
  active: 'success',
  completed: 'brand',
  cancelled: 'error',
};

export function EventsList({
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onActivateClick,
  onCompleteClick,
  onCancelClick,
}: EventsListProps) {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: events, isLoading, error } = useEvents(organizationId);

  if (!organizationId) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="building"
          title="Keine Organisation ausgewählt"
          description="Bitte wählen Sie zuerst eine Organisation aus."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-tertiary">{tCommon('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="text-error-primary">{tCommon('error')}</div>
        <Button color="secondary" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="calendar"
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button iconLeading={Plus} onClick={onCreateClick}>
              {t('create')}
            </Button>
          }
        />
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (startDate?: string, endDate?: string) => {
    if (!startDate) return '-';
    const start = formatDate(startDate);
    if (!endDate) return start;
    return `${start} - ${formatDate(endDate)}`;
  };

  return (
    <TableCard.Root>
      <TableCard.Header
        title={t('title')}
        badge={events.length}
        description={t('subtitle')}
        contentTrailing={
          <Button iconLeading={Plus} onClick={onCreateClick}>
            {t('create')}
          </Button>
        }
      />
      <Table aria-label={t('title')}>
        <Table.Header>
          <Table.Head label={t('table.name')} isRowHeader />
          <Table.Head label={t('table.status')} />
          <Table.Head label={t('table.date')} />
          <Table.Head label={t('table.actions')} />
        </Table.Header>
        <Table.Body items={events}>
          {(event) => (
            <Table.Row key={event.id} id={event.id}>
              <Table.Cell>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-brand-secondary">
                    <Calendar className="size-5 text-brand-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary">{event.name}</p>
                    {event.description && (
                      <p className="text-xs text-tertiary line-clamp-1">{event.description}</p>
                    )}
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <Badge color={statusColorMap[event.status]} size="sm">
                  {t(`status.${event.status}`)}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm">
                  {formatDateTime(event.startDate, event.endDate)}
                </span>
              </Table.Cell>
              <Table.Cell>
                <Dropdown.Root>
                  <Dropdown.DotsButton />
                  <Dropdown.Popover className="w-min">
                    <Dropdown.Menu>
                      <Dropdown.Item icon={Edit01} onAction={() => onEditClick(event)}>
                        <span className="pr-4">{t('actions.edit')}</span>
                      </Dropdown.Item>
                      {event.status === 'draft' && (
                        <Dropdown.Item icon={Play} onAction={() => onActivateClick(event)}>
                          <span className="pr-4">{t('actions.activate')}</span>
                        </Dropdown.Item>
                      )}
                      {event.status === 'active' && (
                        <Dropdown.Item icon={Square} onAction={() => onCompleteClick(event)}>
                          <span className="pr-4">{t('actions.complete')}</span>
                        </Dropdown.Item>
                      )}
                      {(event.status === 'draft' || event.status === 'active') && (
                        <Dropdown.Item icon={XClose} onAction={() => onCancelClick(event)}>
                          <span className="pr-4">{t('actions.cancel')}</span>
                        </Dropdown.Item>
                      )}
                      <Dropdown.Separator />
                      <Dropdown.Item
                        icon={Trash01}
                        className="text-error-primary"
                        onAction={() => onDeleteClick(event)}
                      >
                        <span className="pr-4">{t('actions.delete')}</span>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.Root>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    </TableCard.Root>
  );
}
