'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard02,
  Loading02,
  Plus,
  Trash01,
  Edit03,
  CheckCircle,
  AlertCircle,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { Badge } from '@/components/ui/badges/badges';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
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
    <div className="space-y-6">
      {/* Credentials Card */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <CreditCard02 className="h-5 w-5 text-tertiary" />
            <h3 className="text-lg font-semibold text-primary">{t('credentials.title')}</h3>
          </div>
          <p className="text-sm text-tertiary mt-1">{t('credentials.description')}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sumupApiKey">{t('credentials.apiKey')}</Label>
            <Input
              id="sumupApiKey"
              type="password"
              value={apiKey}
              onChange={setApiKey}
              placeholder={t('credentials.apiKeyPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sumupMerchantCode">{t('credentials.merchantCode')}</Label>
            <Input
              id="sumupMerchantCode"
              value={merchantCode}
              onChange={setMerchantCode}
              placeholder={t('credentials.merchantCodePlaceholder')}
            />
          </div>

          <div className="pt-2 border-t border-secondary">
            <p className="text-sm text-tertiary mb-3">{t('credentials.affiliateDescription')}</p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sumupAffiliateKey">{t('credentials.affiliateKey')}</Label>
                <Input
                  id="sumupAffiliateKey"
                  type="password"
                  value={affiliateKey}
                  onChange={setAffiliateKey}
                  placeholder={t('credentials.affiliateKeyPlaceholder')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sumupAppId">{t('credentials.appId')}</Label>
                <Input
                  id="sumupAppId"
                  value={appId}
                  onChange={setAppId}
                  placeholder={t('credentials.appIdPlaceholder')}
                />
              </div>
            </div>
          </div>

          {credentialsError && (
            <div className="flex items-center gap-2 rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {credentialsError}
            </div>
          )}

          {credentialsSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-success-secondary p-3 text-sm text-success-primary">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {t('credentials.success')}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              color="secondary"
              onClick={() => testConnection.mutate()}
              disabled={!isConfigured || testConnection.isPending}
            >
              {testConnection.isPending ? (
                <Loading02 className="h-4 w-4 animate-spin" />
              ) : (
                t('credentials.testConnection')
              )}
            </Button>
            <Button
              onClick={() => saveCredentials.mutate()}
              disabled={!hasCredentialChanges || saveCredentials.isPending}
            >
              {saveCredentials.isPending ? (
                <Loading02 className="h-4 w-4 animate-spin" />
              ) : (
                tCommon('save')
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Readers Card */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-primary">{t('readers.title')}</h3>
            </div>
            {isConfigured && (
              <Button
                size="sm"
                iconLeading={Plus}
                onClick={() => setShowPairDialog(true)}
              >
                {t('readers.pairReader')}
              </Button>
            )}
          </div>
        </div>

        <div className="p-6">
          {!isConfigured ? (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-tertiary mx-auto mb-2" />
              <p className="text-sm text-tertiary">{t('readers.notConfigured')}</p>
            </div>
          ) : readersQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loading02 className="h-6 w-6 animate-spin text-tertiary" />
            </div>
          ) : readersQuery.data && readersQuery.data.length > 0 ? (
            <div className="divide-y divide-secondary -mx-6">
              {readersQuery.data.map((reader) => (
                <div key={reader.id} className="flex items-center justify-between px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-primary truncate">{reader.name}</p>
                      <ReaderStatusBadge status={reader.status} t={t} />
                    </div>
                    <div className="flex items-center gap-3 text-sm text-tertiary mt-0.5">
                      {reader.device?.identifier && (
                        <span>{t('readers.serialNumber')}: {reader.device.identifier}</span>
                      )}
                      {reader.device?.model && (
                        <span>{t('readers.model')}: {reader.device.model}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <Button
                      size="sm"
                      color="tertiary"
                      onClick={() => {
                        setRenamingReader(reader);
                        setNewReaderName(reader.name);
                      }}
                    >
                      <Edit03 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      color="tertiary-destructive"
                      onClick={() => deleteReaderMutation.mutate(reader.id)}
                      disabled={deleteReaderMutation.isPending}
                    >
                      <Trash01 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard02 className="h-8 w-8 text-tertiary mx-auto mb-2" />
              <p className="text-sm text-tertiary">{t('readers.empty')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Pair Reader Dialog */}
      {showPairDialog && (
        <DialogModal
          isOpen
          onClose={() => {
            setShowPairDialog(false);
            setPairingCode('');
            setPairReaderName('');
          }}
          title={t('readers.pairReader')}
          description={t('readers.pairDescription')}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pairReaderMutation.mutate();
            }}
          >
            <div className="px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pairingCode">{t('readers.pairingCode')}</Label>
                <Input
                  id="pairingCode"
                  value={pairingCode}
                  onChange={setPairingCode}
                  placeholder={t('readers.pairingCodePlaceholder')}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pairReaderName">{t('readers.readerName')}</Label>
                <Input
                  id="pairReaderName"
                  value={pairReaderName}
                  onChange={setPairReaderName}
                  placeholder={t('readers.readerNamePlaceholder')}
                />
              </div>

              {pairReaderMutation.isError && (
                <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                  {t('readers.pairFailed')}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
              <Button
                type="button"
                color="secondary"
                onClick={() => {
                  setShowPairDialog(false);
                  setPairingCode('');
                  setPairReaderName('');
                }}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!pairingCode.trim() || pairReaderMutation.isPending}
              >
                {pairReaderMutation.isPending ? (
                  <Loading02 className="h-5 w-5 animate-spin" />
                ) : (
                  t('readers.pair')
                )}
              </Button>
            </div>
          </form>
        </DialogModal>
      )}

      {/* Rename Reader Dialog */}
      {renamingReader && (
        <DialogModal
          isOpen
          onClose={() => {
            setRenamingReader(null);
            setNewReaderName('');
          }}
          title={t('readers.rename')}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              renameReaderMutation.mutate();
            }}
          >
            <div className="px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="readerName">{t('readers.readerName')}</Label>
                <Input
                  id="readerName"
                  value={newReaderName}
                  onChange={setNewReaderName}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
              <Button
                type="button"
                color="secondary"
                onClick={() => {
                  setRenamingReader(null);
                  setNewReaderName('');
                }}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!newReaderName.trim() || renameReaderMutation.isPending}
              >
                {renameReaderMutation.isPending ? (
                  <Loading02 className="h-5 w-5 animate-spin" />
                ) : (
                  tCommon('save')
                )}
              </Button>
            </div>
          </form>
        </DialogModal>
      )}
    </div>
  );
}

function ReaderStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  switch (status) {
    case 'paired':
      return <Badge color="success" size="sm">{t('readers.status.paired')}</Badge>;
    case 'processing':
      return <Badge color="warning" size="sm">{t('readers.status.processing')}</Badge>;
    case 'expired':
      return <Badge color="error" size="sm">{t('readers.status.expired')}</Badge>;
    default:
      return <Badge color="gray" size="sm">{t('readers.status.unknown')}</Badge>;
  }
}
