'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Building, Globe, Trash2 } from 'lucide-react';
import { Segment, type DataColumn, type RowAction } from '@openeos/ui';

import { useAdminOrganizations } from '@/hooks/use-organizations';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import { AdminTable, CellMain, CellText, ListAction, ListCount, ListHead } from '@/components/shared/admin-table';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { operatingModeLabelValue } from '@/lib/operating-mode';
import type { Organization } from '@/types';
import '@/styles/admin-table-wave4.css';

interface OrganizationsListProps {
  onCreateClick: () => void;
  onEditClick: (organization: Organization) => void;
  onDeleteClick: (organization: Organization) => void;
  /** Betriebsart und Land ändern, Verläufe ansehen — nur Support. */
  onOperatingModeClick: (organization: Organization) => void;
  onManageMembersClick: (organization: Organization) => void;
  /** Sofort endgültig löschen (auf Verlangen, AVV 10.2) — nur Support. */
  onPurgeClick: (organization: Organization) => void;
}

type StatusFilter = 'active' | 'closed';

export function OrganizationsList({
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onManageMembersClick,
  onOperatingModeClick,
  onPurgeClick,
}: OrganizationsListProps) {
  const t = useTranslations('organizations');
  const tMode = useTranslations('operatingMode');
  const tPrivacy = useTranslations('privacy.adminList');
  const { formatDate } = useLocaleFormat();
  const [status, setStatus] = useState<StatusFilter>('active');
  const { data, isLoading, error } = useAdminOrganizations({ status });
  const organizations = data?.data;

  const filter = (
    <div style={{ marginBottom: 14 }}>
      <Segment<StatusFilter>
        aria-label={tPrivacy('filter')}
        value={status}
        onChange={setStatus}
        options={[
          { id: 'active', label: tPrivacy('active') },
          { id: 'closed', label: tPrivacy('closed') },
        ]}
      />
    </div>
  );
  const withFilter = (content: ReactNode) => (
    <>
      {filter}
      {content}
    </>
  );

  /* Gelöschte Organisationen: Termin der endgültigen Löschung bzw. „endgültig gelöscht“. */
  const closureBadge = (org: Organization) =>
    org.closure ? (
      <span className="privacy-badge" data-testid="closure-badge">
        {org.closure.purged
          ? tPrivacy('purged')
          : tPrivacy('scheduled', { date: formatDate(org.closure.finalDeletionAt) })}
      </span>
    ) : null;

  if (isLoading) {
    return withFilter(<ListLoading />);
  }

  if (error) {
    return withFilter(<ListError />);
  }

  if (status === 'closed' && (!organizations || organizations.length === 0)) {
    return withFilter(
      <ListEmpty title={tPrivacy('emptyTitle')} description={tPrivacy('emptyDescription')} icon={<Building size={28} />} />,
    );
  }

  if (!organizations || organizations.length === 0) {
    return withFilter(
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Building size={28} />
        }
        action={
          <button type="button" className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        }
      />,
    );
  }

  /** Währung und Betriebsart, wie bisher unter dem Namen. */
  const details = (org: Organization) =>
    [org.settings?.currency || 'EUR', org.operatingMode ? tMode(`names.${operatingModeLabelValue(org)}`) : null]
      .filter(Boolean)
      .join(' · ');

  const columns: DataColumn<Organization>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (org) => (
        <CellMain
          media={
            <span className="wave4-initials" aria-hidden>
              {org.name.substring(0, 2).toUpperCase()}
            </span>
          }
          title={org.name}
          titleText={org.name}
          sub={details(org)}
          extra={closureBadge(org)}
        />
      ),
    },
    {
      // Telefon: Löschtermin vorn in Zeile 2 (die Zusätze der Namenszelle fehlen dort).
      id: 'closure',
      header: tPrivacy('filter'),
      mobile: 'subtitle',
      className: 'admin-dt__phone-only',
      cell: (org) => closureBadge(org),
    },
    {
      id: 'slug',
      header: t('table.slug'),
      mobile: 'hidden',
      className: 'wave4-mono',
      cell: (org) => <CellText title={org.slug}>{org.slug}</CellText>,
    },
    {
      // Telefon: Währung und Betriebsart.
      id: 'details',
      header: t('form.currency'),
      mobile: 'meta',
      className: 'admin-dt__phone-only',
      cell: (org) => details(org),
    },
    {
      id: 'createdAt',
      header: t('table.createdAt'),
      mobile: 'meta',
      className: 'wave4-date',
      cell: (org) => formatDate(org.createdAt),
    },
  ];

  /* Bearbeiten und Mitglieder als Symbol in der Zeile, Betriebsart und das
     Löschen im Menü. Gelöschte Organisationen: nur „Endgültig löschen“
     (solange noch nicht geschehen). */
  const actions = (org: Organization): RowAction[] => [
    { id: 'edit', label: t('actions.edit'), icon: 'edit', hidden: !!org.closure, onClick: () => onEditClick(org) },
    {
      id: 'members',
      label: t('actions.manageMembers'),
      icon: 'users',
      hidden: !!org.closure,
      onClick: () => onManageMembersClick(org),
    },
    {
      id: 'operatingMode',
      label: t('actions.operatingMode'),
      icon: <Globe />,
      hidden: !!org.closure,
      onClick: () => onOperatingModeClick(org),
    },
    {
      id: 'delete',
      label: t('actions.delete'),
      icon: 'trash',
      danger: true,
      hidden: !!org.closure,
      onClick: () => onDeleteClick(org),
    },
    {
      id: 'purge',
      label: tPrivacy('purge'),
      icon: <Trash2 />,
      danger: true,
      hidden: !!org.closure?.purged,
      onClick: () => onPurgeClick(org),
    },
  ];

  return (
    <>
      {filter}
      <div className="app-card app-card--flat">
        <ListHead actions={<ListAction variant="primary" icon="plus" label={t('create')} onClick={onCreateClick} />}>
          <ListCount>{t('count', { count: organizations.length })}</ListCount>
        </ListHead>

        <AdminTable caption={t('title')} rows={organizations} rowKey="id" columns={columns} actions={actions} />
      </div>
    </>
  );
}
