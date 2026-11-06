'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Building } from 'lucide-react';
import { Segment } from '@openeos/ui';

import { useAdminOrganizations } from '@/hooks/use-organizations';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { operatingModeLabelValue } from '@/lib/operating-mode';
import type { Organization } from '@/types';

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

  const purgeButton = (org: Organization, size: 'sm' | 'md') =>
    org.closure?.purged ? null : (
      <button
        type="button"
        className="btn btn--ghost"
        style={{
          fontSize: size === 'sm' ? 11 : 12,
          padding: size === 'sm' ? '3px 8px' : '4px 10px',
          color: 'var(--red, var(--danger))',
        }}
        onClick={() => onPurgeClick(org)}
        data-testid="purge-organization"
      >
        {tPrivacy('purge')}
      </button>
    );

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

  return (
    <>
      {filter}
      {/* Mobile card list */}
      {/* Kartenliste nur schmal. Das Layout darf NICHT inline stehen:
          ein inline display:flex schlaegt md:hidden, dadurch standen
          Karten und Tabelle auf breiten Viewports uebereinander. */}
      <div className="flex flex-col gap-2.5 md:hidden">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 13, color: 'var(--ink)', opacity: .6 }}>{t('count', { count: organizations.length })}</p>
          <button type="button" className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        </div>
        {organizations.map((org) => (
          <div key={org.id} className="app-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                color: 'var(--green-ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {org.name.substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {org.name}
                </p>
                <p className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)', margin: '2px 0 6px' }}>{org.slug}</p>
                {closureBadge(org)}
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--ink-faint)' }}>
                  <span>{org.settings?.currency || 'EUR'}</span>
                  {org.operatingMode && <span>{tMode(`names.${operatingModeLabelValue(org)}`)}</span>}
                  <span>{formatDate(org.createdAt)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                {!org.closure && (
                  <>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => onEditClick(org)}
                >
                  {t('actions.edit')}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => onManageMembersClick(org)}
                >
                  {t('actions.manageMembers')}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => onOperatingModeClick(org)}
                >
                  {t('actions.operatingMode')}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red, var(--danger))' }}
                  onClick={() => onDeleteClick(org)}
                >
                  {t('actions.delete')}
                </button>
                  </>
                )}
                {purgeButton(org, 'sm')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="app-card app-card--flat hidden md:block">
        <div className="app-card__head">
          <div>
            <p style={{ fontSize: 13, color: 'var(--ink)', opacity: .6 }}>{t('count', { count: organizations.length })}</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.name')}</th>
                <th>{t('table.slug')}</th>
                <th>{t('table.createdAt')}</th>
                <th>{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                        color: 'var(--green-ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {org.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
                          {org.name} {closureBadge(org)}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: 0 }}>
                          {org.settings?.currency || 'EUR'}
                          {org.operatingMode ? ` · ${tMode(`names.${operatingModeLabelValue(org)}`)}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{org.slug}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{formatDate(org.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!org.closure && (
                        <>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => onEditClick(org)}
                      >
                        {t('actions.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => onManageMembersClick(org)}
                      >
                        {t('actions.manageMembers')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => onOperatingModeClick(org)}
                      >
                        {t('actions.operatingMode')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ fontSize: 12, padding: '4px 10px', color: 'var(--red, var(--danger))' }}
                        onClick={() => onDeleteClick(org)}
                      >
                        {t('actions.delete')}
                      </button>
                        </>
                      )}
                      {purgeButton(org, 'md')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
