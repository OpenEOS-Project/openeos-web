'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi, sumupApi } from '@/lib/api-client';
import type { SumUpReader } from '@/types/sumup';

export function OrganizationSumupSection() {
  const t = useTranslations('settings.organizationSumup');
  const tCommon = useTranslations('common');
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();

  const organizationId = currentOrganization?.organizationId;
  const sumupSettings = currentOrganization?.organization?.settings?.sumup;
  const isConfigured = !!sumupSettings?.merchantCode;

  // Credentials form state
  const [apiKey, setApiKey] = useState(sumupSettings?.apiKey || '');
  const [merchantCode, setMerchantCode] = useState(sumupSettings?.merchantCode || '');
  const [affiliateKey, setAffiliateKey] = useState(sumupSettings?.affiliateKey || '');
  const [appId, setAppId] = useState(sumupSettings?.appId || '');
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialsSuccess, setCredentialsSuccess] = useState(false);

  // Pair reader dialog
  const [showPairDialog, setShowPairDialog] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairReaderName, setPairReaderName] = useState('');

  // Rename reader dialog
  const [renamingReader, setRenamingReader] = useState<SumUpReader | null>(null);
  const [newReaderName, setNewReaderName] = useState('');

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
      setCredentialsError(null);
      setCredentialsSuccess(true);
      setTimeout(() => setCredentialsSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['sumup-readers', organizationId] });
    },
    onError: () => {
      setCredentialsError(t('credentials.saveFailed'));
    },
  });

  // Test connection
  const testConnection = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization');
      return sumupApi.testConnection(organizationId);
    },
    onSuccess: () => {
      setCredentialsError(null);
      setCredentialsSuccess(true);
      setTimeout(() => setCredentialsSuccess(false), 3000);
    },
    onError: () => {
      setCredentialsError(t('credentials.testFailed'));
      setCredentialsSuccess(false);
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
  });

  // Delete reader
  const deleteReaderMutation = useMutation({
    mutationFn: async (readerId: string) => {
      if (!organizationId) throw new Error('No organization');
      return sumupApi.deleteReader(organizationId, readerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sumup-readers', organizationId] });
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

          {credentialsError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, background: 'color-mix(in oklab, #dc2626 10%, transparent)', padding: '10px 12px', fontSize: 13, color: '#dc2626' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {credentialsError}
            </div>
          )}

          {credentialsSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, background: 'color-mix(in oklab, var(--green-ink) 10%, transparent)', padding: '10px 12px', fontSize: 13, color: 'var(--green-ink)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              {t('credentials.success')}
            </div>
          )}

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
              + {t('readers.pairReader')}
            </button>
          )}
        </div>

        <div style={{ padding: 20 }}>
          {!isConfigured ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              </div>
              <p className="empty-state__sub">{t('readers.notConfigured')}</p>
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
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ padding: '4px 8px', color: '#dc2626' }}
                          onClick={() => deleteReaderMutation.mutate(reader.id)}
                          disabled={deleteReaderMutation.isPending}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
              </div>
              <p className="empty-state__sub">{t('readers.empty')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Pair Reader Dialog */}
      {showPairDialog && (
        <div className="modal__backdrop" onClick={() => { setShowPairDialog(false); setPairingCode(''); setPairReaderName(''); }}>
          <div className="modal__box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('readers.pairReader')}</h2>
                <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 2 }}>{t('readers.pairDescription')}</p>
              </div>
              <button className="modal__close" type="button" onClick={() => { setShowPairDialog(false); setPairingCode(''); setPairReaderName(''); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
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
                  <div style={{ borderRadius: 8, background: 'color-mix(in oklab, #dc2626 10%, transparent)', padding: '10px 12px', fontSize: 13, color: '#dc2626' }}>
                    {t('readers.pairFailed')}
                  </div>
                )}
              </div>

              <div className="modal__footer">
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

      {/* Rename Reader Dialog */}
      {renamingReader && (
        <div className="modal__backdrop" onClick={() => { setRenamingReader(null); setNewReaderName(''); }}>
          <div className="modal__box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal__header">
              <h2 className="modal__title">{t('readers.rename')}</h2>
              <button className="modal__close" type="button" onClick={() => { setRenamingReader(null); setNewReaderName(''); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
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

              <div className="modal__footer">
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
