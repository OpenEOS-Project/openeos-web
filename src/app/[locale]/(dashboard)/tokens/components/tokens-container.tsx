'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

import { ListEmpty } from '@/components/shared/list-states';
import { useOperatingMode } from '@/hooks/use-operating-mode';
import { Link } from '@/i18n/routing';
import { OPERATING_MODE_SETTINGS_HREF } from '@/lib/operating-mode';
import { tokensUnavailableReason } from '@/lib/token-admin';
import { useAuthStore } from '@/stores/auth-store';
import type { TokenType } from '@/types/token';

import { TokenTypeDeleteDialog } from './token-type-delete-dialog';
import { TokenTypeFormModal } from './token-type-form-modal';
import { TokenTypeList } from './token-type-list';
import { TokensReport } from './tokens-report';

import '@/styles/tokens.css';

/**
 * Wertmarken: Markentypen (Recht „Produkte“) und Auswertung.
 *
 * Wo Wertmarken an der Kasse nicht gehen („Nur Bons“, „Bargeldlos“,
 * Deutschland ohne Cloud-TSE), sagt ein Hinweis warum — die Typen lassen
 * sich trotzdem schon anlegen.
 */
export function TokensContainer() {
  const t = useTranslations('tokens');
  const tCommon = useTranslations('common');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TokenType | null>(null);
  const [removing, setRemoving] = useState<TokenType | null>(null);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';
  const isAdmin = currentOrganization?.role === 'admin';
  const reason = tokensUnavailableReason(useOperatingMode());

  if (!organizationId) {
    return (
      <ListEmpty title={tCommon('noOrganization.title')} description={tCommon('noOrganization.description')} />
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {reason && (
          <Banner tone="warn" icon={<Icon name="alert" />} title={t('notAllowed.title')}>
            <span data-testid="tokens-not-allowed">
              {t(`notAllowed.${reason}`)}{' '}
              {isAdmin && (
                <Link href={OPERATING_MODE_SETTINGS_HREF} className="notice-link">
                  {t('notAllowed.link')}
                </Link>
              )}
            </span>
          </Banner>
        )}

        <TokenTypeList
          organizationId={organizationId}
          onCreateClick={() => setIsCreateOpen(true)}
          onEditClick={setEditing}
          onDeleteClick={setRemoving}
        />

        <TokensReport organizationId={organizationId} />
      </div>

      <TokenTypeFormModal
        isOpen={isCreateOpen || !!editing}
        organizationId={organizationId}
        tokenType={editing}
        onClose={() => {
          setIsCreateOpen(false);
          setEditing(null);
        }}
      />

      {removing && (
        <TokenTypeDeleteDialog
          organizationId={organizationId}
          tokenType={removing}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
