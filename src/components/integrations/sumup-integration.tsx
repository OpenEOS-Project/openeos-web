'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@openeos/ui';
import { CircleAlert } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi, sumupApi } from '@/lib/api-client';
import type { SumUpReader } from '@/types/sumup';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { useIntegrationErrorMessage } from '@/hooks/use-integrations';

export function SumUpIntegration() {
  const t = useTranslations('settings.organizationSumup');
  const tCommon = useTranslations('common');
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();
  // Die SumUp-Endpunkte antworten bei ausgeschalteter Integration mit 403
  // INTEGRATION_DISABLED — das soll als verständlicher Hinweis ankommen und
  // nicht als allgemeines "fehlgeschlagen".
  const integrationError = useIntegrationErrorMessage();

  const organizationId = currentOrganization?.organizationId;
  const sumupSettings = currentOrganization?.organization?.settings?.sumup;
  const isConfigured = !!sumupSettings?.merchantCode;

  // Credentials form state
  const [apiKey, setApiKey] = useState(sumupSettings?.apiKey || '');
  const [merchantCode, setMerchantCode] = useState(sumupSettings?.merchantCode || '');
  const [affiliateKey, setAffiliateKey] = useState(sumupSettings?.affiliateKey || '');
  const [appId, setAppId] = useState(sumupSettings?.appId || '');

  // Pair reader dialog
  const [showPairDialog, setShowPairDialog] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairReaderName, setPairReaderName] = useState('');

  // Rename reader dialog
  const [renamingReader, setRenamingReader] = useState<SumUpReader | null>(null);
  const [newReaderName, setNewReaderName] = useState('');

  // Delete confirmation — ein Klick auf den Papierkorb entkoppelt den Leser
  // bei SumUp; das soll nicht versehentlich passieren.
  const [deletingReader, setDeletingReader] = useState<SumUpReader | null>(null);

  // Save credentials
  const saveCredentials = useMutation({
    mutationFn: async () => {
      if (!currentOrganization) throw new Error('No organization');

      const settingsUpdate: Record<string, unknown> = {
        ...currentOrganization.organization?.settings,
        sumup: {
          apiKey,
          merchantCode,
          ...(affiliateKey ? { affiliateKey } : {}),
          ...(appId ? { appId } : {}),
        },
      };

      const response = await organizationsApi.update(currentOrganization.organizationId, {
        settings: settingsUpdate as unknown as import('@/types/organization').OrganizationSettings,
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({
          ...currentOrganization,
          organization: data,
        });
      }
      setApiKey(data.settings?.sumup?.apiKey || '');
      setMerchantCode(data.settings?.sumup?.merchantCode || '');
      setAffiliateKey(data.settings?.sumup?.affiliateKey || '');
      setAppId(data.settings?.sumup?.appId || '');
      toast.success(t('credentials.success'));
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['sumup-readers', organizationId] });
    },
    onError: () => {
      toast.error(t('credentials.saveFailed'));
    },
  });

  // Test connection
  const testConnection = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization');
      return sumupApi.testConnection(organizationId);
    },
    onSuccess: () => {
      toast.success(t('credentials.success'));
    },
    onError: (error) => {
      toast.error(integrationError(error, t('credentials.testFailed')));
    },
  });

  // Load readers
  const readersQuery = useQuery({
    queryKey: ['sumup-readers', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const response = await sumupApi.listReaders(organizationId);
      return response.data || [];
    },
    enabled: !!organizationId && isConfigured,
  });

  // Pair reader
  const pairReaderMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization');
      return sumupApi.pairReader(organizationId, pairingCode, pairReaderName || undefined);
    },
    onSuccess: () => {
      setShowPairDialog(false);
      setPairingCode('');
      setPairReaderName('');
      queryClient.invalidateQueries({ queryKey: ['sumup-readers', organizationId] });
    },
    // Die Meldung steht im Dialog (pairReaderMutation.error) — kein Toast.
  });

  // Rename reader
  const renameReaderMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId || !renamingReader) throw new Error('Missing data');
      return sumupApi.updateReader(organizationId, renamingReader.id, newReaderName);
    },
    onSuccess: () => {
      setRenamingReader(null);
      setNewReaderName('');
      queryClient.invalidateQueries({ queryKey: ['sumup-readers', organizationId] });
    },
    onError: (error) => {
      toast.error(integrationError(error, t('readers.renameFailed')));
    },
  });

  // Delete reader
  const deleteReaderMutation = useMutation({
    mutationFn: async (readerId: string) => {
      if (!organizationId) throw new Error('No organization');
      return sumupApi.deleteReader(organizationId, readerId);
    },
    onSuccess: () => {
      setDeletingReader(null);
      queryClient.invalidateQueries({ queryKey: ['sumup-readers', organizationId] });
    },
    onError: (error) => {
      toast.error(integrationError(error, t('readers.deleteFailed')));
    },
  });

  if (!currentOrganization) {
    return null;
  }

  const hasCredentialChanges =
    apiKey !== (sumupSettings?.apiKey || '') ||
    merchantCode !== (sumupSettings?.merchantCode || '') ||
    affiliateKey !== (sumupSettings?.affiliateKey || '') ||
    appId !== (sumupSettings?.appId || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Credentials Card */}
      <div className="app-card">
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t('credentials.title')}</h3>
          <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('credentials.description')}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="sumupApiKey">{t('credentials.apiKey')}</label>
            <input
              id="sumupApiKey"
              type="password"
              className="input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('credentials.apiKeyPlaceholder')}
            />
          </div>

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="sumupMerchantCode">{t('credentials.merchantCode')}</label>
            <input
              id="sumupMerchantCode"
              className="input"
              value={merchantCode}
              onChange={(e) => setMerchantCode(e.target.value)}
              placeholder={t('credentials.merchantCodePlaceholder')}
            />
          </div>

          <div style={{ paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
            <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 12 }}>{t('credentials.affiliateDescription')}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="sumupAffiliateKey">{t('credentials.affiliateKey')}</label>
                <input
                  id="sumupAffiliateKey"
                  type="password"
                  className="input"
                  value={affiliateKey}
                  onChange={(e) => setAffiliateKey(e.target.value)}
                  placeholder={t('credentials.affiliateKeyPlaceholder')}
                />
              </div>

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="sumupAppId">{t('credentials.appId')}</label>
                <input
                  id="sumupAppId"
                  className="input"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder={t('credentials.appIdPlaceholder')}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => testConnection.mutate()}
              disabled={!isConfigured || testConnection.isPending}
            >
              {testConnection.isPending ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              ) : t('credentials.testConnection')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => saveCredentials.mutate()}
              disabled={!hasCredentialChanges || saveCredentials.isPending}
            >
              {saveCredentials.isPending ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              ) : tCommon('save')}
            </button>
          </div>
        </div>
      </div>

      {/* Readers Card */}
      <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>{t('readers.title')}</h3>
          {isConfigured && (
            <button type="button" className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setShowPairDialog(true)}>
              <Icon name="plus" />
              {t('readers.pairReader')}
            </button>
          )}
        </div>

        <div style={{ padding: 20 }}>
          {!isConfigured ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <CircleAlert size={24} />
              </div>
              <p className="empty-state__sub">{t('readers.notConfigured')}</p>
            </div>
          ) : readersQuery.isError ? (
            <div role="alert" style={{ borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 10%, transparent)', padding: '10px 12px', fontSize: 13, color: 'var(--danger)' }}>
              {integrationError(readersQuery.error, tCommon('error'))}
            </div>
          ) : readersQuery.isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : readersQuery.data && readersQuery.data.length > 0 ? (
            <table className="data-table">
              <tbody>
                {readersQuery.data.map((reader) => (
                  <tr key={reader.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 500 }}>{reader.name}</span>
                        <ReaderStatusBadge status={reader.status} t={t} />
                      </div>
                      {(reader.device?.identifier || reader.device?.model) && (
                        <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 2, display: 'flex', gap: 12 }}>
                          {reader.device?.identifier && <span>{t('readers.serialNumber')}: {reader.device.identifier}</span>}
                          {reader.device?.model && <span>{t('readers.model')}: {reader.device.model}</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ padding: '4px 8px' }}
                          onClick={() => { setRenamingReader(reader); setNewReaderName(reader.name); }}
                          aria-label={t('readers.renameReader', { name: reader.name })}
                          title={t('readers.rename')}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ padding: '4px 8px', color: 'var(--danger)' }}
                          onClick={() => setDeletingReader(reader)}
                          disabled={deleteReaderMutation.isPending}
                          aria-label={t('readers.deleteReader', { name: reader.name })}
                          title={t('readers.delete')}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">
                <Icon name="card" size={24} />
              </div>
              <p className="empty-state__sub">{t('readers.empty')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Pair Reader Dialog */}
      {showPairDialog && (
        <div className="modal__backdrop" onClick={() => { setShowPairDialog(false); setPairingCode(''); setPairReaderName(''); }}>
          <div className="modal__box modal__panel--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h2 className="modal__title">{t('readers.pairReader')}</h2>
                <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 2 }}>{t('readers.pairDescription')}</p>
              </div>
              <DialogCloseButton onClick={() => { setShowPairDialog(false); setPairingCode(''); setPairReaderName(''); }} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); pairReaderMutation.mutate(); }}>
              <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="pairingCode">{t('readers.pairingCode')}</label>
                  <input
                    id="pairingCode"
                    className="input"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    placeholder={t('readers.pairingCodePlaceholder')}
                    autoFocus
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="pairReaderName">{t('readers.readerName')}</label>
                  <input
                    id="pairReaderName"
                    className="input"
                    value={pairReaderName}
                    onChange={(e) => setPairReaderName(e.target.value)}
                    placeholder={t('readers.readerNamePlaceholder')}
                  />
                </div>

                {pairReaderMutation.isError && (
                  <div role="alert" style={{ borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 10%, transparent)', padding: '10px 12px', fontSize: 13, color: 'var(--danger)' }}>
                    {integrationError(pairReaderMutation.error, t('readers.pairFailed'))}
                  </div>
                )}
              </div>

              <div className="modal__foot">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => { setShowPairDialog(false); setPairingCode(''); setPairReaderName(''); }}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!pairingCode.trim() || pairReaderMutation.isPending}
                >
                  {pairReaderMutation.isPending ? (
                    <>
                      <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </>
                  ) : t('readers.pair')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Reader Confirmation */}
      {deletingReader && (
        <div className="modal__overlay" onClick={() => setDeletingReader(null)}>
          <ModalPanel titleId="delete-sumup-reader-title" className="modal__panel--sm">
            <div className="modal__head">
              <h2 id="delete-sumup-reader-title">{t('readers.deleteConfirmTitle')}</h2>
              <DialogCloseButton onClick={() => setDeletingReader(null)} />
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', margin: 0 }}>
                {t('readers.deleteConfirmMessage', { name: deletingReader.name })}
              </p>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setDeletingReader(null)}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => deleteReaderMutation.mutate(deletingReader.id)}
                disabled={deleteReaderMutation.isPending}
              >
                {deleteReaderMutation.isPending ? tCommon('deleting') : tCommon('delete')}
              </button>
            </div>
          </ModalPanel>
        </div>
      )}

      {/* Rename Reader Dialog */}
      {renamingReader && (
        <div className="modal__backdrop" onClick={() => { setRenamingReader(null); setNewReaderName(''); }}>
          <div className="modal__box modal__panel--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2 className="modal__title">{t('readers.rename')}</h2>
              <DialogCloseButton onClick={() => { setRenamingReader(null); setNewReaderName(''); }} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); renameReaderMutation.mutate(); }}>
              <div className="modal__body">
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="readerName">{t('readers.readerName')}</label>
                  <input
                    id="readerName"
                    className="input"
                    value={newReaderName}
                    onChange={(e) => setNewReaderName(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="modal__foot">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => { setRenamingReader(null); setNewReaderName(''); }}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!newReaderName.trim() || renameReaderMutation.isPending}
                >
                  {renameReaderMutation.isPending ? (
                    <>
                      <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </>
                  ) : tCommon('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ReaderStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  switch (status) {
    case 'paired':
      return <span className="badge badge--success">{t('readers.status.paired')}</span>;
    case 'processing':
      return <span className="badge badge--warning">{t('readers.status.processing')}</span>;
    case 'expired':
      return <span className="badge badge--error">{t('readers.status.expired')}</span>;
    default:
      return <span className="badge badge--neutral">{t('readers.status.unknown')}</span>;
  }
}
