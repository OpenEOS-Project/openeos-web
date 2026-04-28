'use client';

import { useTranslations } from 'next-intl';

import { useAdminOrganizations } from '@/hooks/use-organizations';
import type { Organization } from '@/types';

interface OrganizationsListProps {
  onCreateClick: () => void;
  onEditClick: (organization: Organization) => void;
  onDeleteClick: (organization: Organization) => void;
  onManageMembersClick: (organization: Organization) => void;
}

export function OrganizationsList({ onCreateClick, onEditClick, onDeleteClick, onManageMembersClick }: OrganizationsListProps) {
  const t = useTranslations('organizations');
  const tCommon = useTranslations('common');
  const { data, isLoading, error } = useAdminOrganizations();
  const organizations = data?.data;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <span style={{ fontSize: 14, color: 'var(--ink-faint)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
        <span style={{ fontSize: 14, color: 'var(--red, #dc2626)' }}>{tCommon('error')}</span>
        <button type="button" className="btn btn--ghost" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('empty.title')}</h3>
          <p className="empty-state__sub">{t('empty.description')}</p>
          <button type="button" className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        </div>
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

  return (
    <>
      {/* Mobile card list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="md:hidden">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>{t('title')}</h2>
            <span className="badge badge--neutral">{organizations.length}</span>
          </div>
          <button type="button" className="btn btn--primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={onCreateClick}>
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
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--ink-faint)' }}>
                  <span>{org.settings?.currency || 'EUR'}</span>
                  <span>{formatDate(org.createdAt)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
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
                  style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red, #dc2626)' }}
                  onClick={() => onDeleteClick(org)}
                >
                  {t('actions.delete')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="app-card app-card--flat hidden md:block">
        <div className="app-card__head">
          <div>
            <h2 className="app-card__title">
              {t('title')}
              <span className="pill" style={{ marginLeft: 8 }}>{organizations.length}</span>
            </h2>
            <p className="app-card__sub">{t('subtitle')}</p>
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
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{org.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: 0 }}>{org.settings?.currency || 'EUR'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{org.slug}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{formatDate(org.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
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
                        style={{ fontSize: 12, padding: '4px 10px', color: 'var(--red, #dc2626)' }}
                        onClick={() => onDeleteClick(org)}
                      >
                        {t('actions.delete')}
                      </button>
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
