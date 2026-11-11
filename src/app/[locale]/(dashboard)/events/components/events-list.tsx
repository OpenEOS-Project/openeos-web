'use client';

import { useTranslations } from 'next-intl';
import { Icon, type DataColumn, type RowAction } from '@openeos/ui';
import { BadgeCheck, Building, ExternalLink, FlaskConical, Pause, Play } from 'lucide-react';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { useEvents } from '@/hooks/use-events';
import { shopUrlForEvent } from '@/lib/shop-url';
import { useAuthStore } from '@/stores/auth-store';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import { AdminTable, CellMain, ListAction, ListCount, ListHead } from '@/components/shared/admin-table';
import { LegalInfoWarning } from '@/components/shared/legal-info-warning';
import { EventPhaseBadge, EventPhaseHint } from '@/components/shared/event-phase';
import { EventEmergencySupportNotice } from '@/components/shared/event-emergency-support-notice';
import type { Event } from '@/types';

interface EventsListProps {
  onCreateClick: () => void;
  onEditClick: (event: Event) => void;
  onDeleteClick: (event: Event) => void;
  onActivateClick: (event: Event) => void;
  onDeactivateClick: (event: Event) => void;
  onSetTestModeClick: (event: Event) => void;
  /**
   * Freischaltung ansehen bzw. stornieren. Nur im gehosteten Betrieb
   * gesetzt — ohne Abrechnung gibt es nichts freizuschalten.
   */
  onUnlockClick?: (event: Event) => void;
  /** Event currently being checked/activated — shows a busy state on its activate button. */
  activatingEventId?: string | null;
}

export function EventsList({
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onActivateClick,
  onDeactivateClick,
  onSetTestModeClick,
  onUnlockClick,
  activatingEventId,
}: EventsListProps) {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const locale = useIntlLocale();
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: events, isLoading, error } = useEvents(organizationId);

  if (!organizationId) {
    return (
      <ListEmpty
        title={tCommon('noOrganization.title')}
        description={tCommon('noOrganization.description')}
        icon={
          <Building size={28} />
        }
      />
    );
  }

  if (isLoading) {
    return <ListLoading />;
  }

  if (error) {
    return <ListError />;
  }

  if (!events || events.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Icon name="calendar" size={28} />
        }
        action={
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        }
      />
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate) return '-';
    const start = formatDate(startDate);
    // Eintägige Veranstaltungen: nur ein Datum anzeigen (Altbestand kann mehrtägig sein)
    if (!endDate || formatDate(endDate) === start) return start;
    return `${start} – ${formatDate(endDate)}`;
  };

  const isUnlocked = (event: Event) =>
    event.billingStatus === 'paid' || event.billingStatus === 'invoice' || event.billingStatus === 'waived';

  const columns: DataColumn<Event>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (event) => (
        <CellMain
          media={
            <span className="events-list__icon" aria-hidden>
              <Icon name="calendar" size={16} />
            </span>
          }
          title={event.name}
          titleText={event.name}
          sub={event.description || undefined}
          subText={event.description || undefined}
        />
      ),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (event) => (
        /* Phase statt Status: eine bezahlte Veranstaltung vor ihrem Termin
           ist „Geplant“ (Testbetrieb), danach „Beendet“. */
        <span className="events-list__phase">
          <EventPhaseBadge event={event} />
          <EventPhaseHint event={event} className="events-list__hint" />
        </span>
      ),
    },
    {
      id: 'date',
      header: t('table.date'),
      mobile: 'meta',
      className: 'events-list__date',
      cell: (event) => formatDateTime(event.startDate, event.endDate),
    },
    {
      // Telefon: der Phasenhinweis als eigener Teil der zweiten Zeile.
      id: 'phaseHint',
      header: t('table.status'),
      mobile: 'meta',
      className: 'admin-dt__phone-only',
      cell: (event) => <EventPhaseHint event={event} className="events-list__hint-inline" />,
    },
  ];

  /* Häufiges zuerst: Bearbeiten und der passende Statuswechsel stehen als
     Symbol in der Zeile, der Rest (Freischaltung, Shop, Löschen) im Menü. */
  const actions = (event: Event): RowAction[] => [
    { id: 'edit', label: t('actions.edit'), icon: 'edit', onClick: () => onEditClick(event) },
    {
      id: 'activate',
      label: t('actions.activate'),
      icon: <Play />,
      primary: true,
      hidden: !(event.status === 'inactive' || event.status === 'test'),
      disabled: activatingEventId === event.id,
      onClick: () => onActivateClick(event),
    },
    {
      id: 'testMode',
      label: t('actions.testMode'),
      icon: <FlaskConical />,
      hidden: event.status !== 'inactive',
      onClick: () => onSetTestModeClick(event),
    },
    {
      id: 'deactivate',
      label: t('actions.deactivate'),
      icon: <Pause />,
      hidden: !(event.status === 'active' || event.status === 'test'),
      onClick: () => onDeactivateClick(event),
    },
    {
      id: 'unlock',
      label: t('actions.unlock'),
      icon: <BadgeCheck />,
      hidden: !onUnlockClick || !isUnlocked(event),
      onClick: () => onUnlockClick?.(event),
    },
    {
      id: 'shop',
      label: t('actions.openShop'),
      icon: <ExternalLink />,
      hidden: !event.settings?.shop?.enabled,
      // Neuer Tab wie zuvor (RowAction kennt kein target).
      onClick: () => window.open(shopUrlForEvent(event.id), '_blank', 'noopener,noreferrer'),
    },
    { id: 'delete', label: t('actions.delete'), icon: 'trash', danger: true, onClick: () => onDeleteClick(event) },
  ];

  return (
    <div className="app-card app-card--flat">
      {/* Titel und Untertitel standen schon im Seitenkopf darueber; hier
          steht wie bei den Geraeten nur die Anzahl. */}
      <ListHead actions={<ListAction variant="primary" icon="plus" label={t('create')} onClick={onCreateClick} />}>
        <ListCount>{t('count', { count: events.length })}</ListCount>
      </ListHead>

      <EventEmergencySupportNotice organizationId={organizationId} events={events} wrapperClassName="events-list__legal" />

      {/* Shop-Link in der Liste, aber noch ohne Impressum/Datenschutz: der
          Shop nimmt dann keine Bestellungen an (auch im Testmodus). */}
      {events.some((event) => event.settings?.shop?.enabled) && (
        <div className="events-list__legal">
          <LegalInfoWarning context="shopList" />
        </div>
      )}

      <AdminTable
        caption={t('title')}
        rows={events}
        rowKey="id"
        columns={columns}
        actions={actions}
      />
    </div>
  );
}
