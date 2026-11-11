'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';

import { toast } from '@/components/shared/toast';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useDeleteWebhook, useTestWebhook } from '@/hooks/use-webhooks';

import type { WebhookEndpoint } from '@/types/webhook';

import { WebhookDeleteDialog, WebhookRotateDialog } from './webhook-confirm-dialogs';
import { WebhookFormDialog } from './webhook-form-dialog';

/**
 * Aktionen auf einem Webhook samt Dialogen — dieselben in der Liste der
 * Einstellungen und auf der Seite mit den Zustellungen.
 */
export function useWebhookActions(organizationId: string, { onDeleted }: { onDeleted?: () => void } = {}) {
  const t = useTranslations('settings.organizationWebhooks');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const test = useTestWebhook(organizationId);
  const remove = useDeleteWebhook(organizationId);

  const [formTarget, setFormTarget] = useState<WebhookEndpoint | 'new' | null>(null);
  const [rotateTarget, setRotateTarget] = useState<WebhookEndpoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null);

  const sendTest = useCallback(
    (endpoint: WebhookEndpoint) => {
      test.mutate(endpoint.id, {
        onSuccess: () => toast.success(t('testQueued')),
        onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
      });
    },
    [test, t, apiErrorMessage, tCommon]
  );

  const onDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast.success(t('deleted'));
        onDeleted?.();
      },
      onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
    });
  };

  const closeForm = useCallback(() => setFormTarget(null), []);
  const closeRotate = useCallback(() => setRotateTarget(null), []);
  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const dialogs = (
    <>
      {formTarget && (
        <WebhookFormDialog
          organizationId={organizationId}
          endpoint={formTarget === 'new' ? null : formTarget}
          onClose={closeForm}
        />
      )}
      {rotateTarget && (
        <WebhookRotateDialog organizationId={organizationId} endpoint={rotateTarget} onClose={closeRotate} />
      )}
      {deleteTarget && (
        <WebhookDeleteDialog
          endpoint={deleteTarget}
          pending={remove.isPending}
          onConfirm={onDelete}
          onCancel={cancelDelete}
        />
      )}
    </>
  );

  return {
    openCreate: () => setFormTarget('new'),
    openEdit: (endpoint: WebhookEndpoint) => setFormTarget(endpoint),
    openRotate: (endpoint: WebhookEndpoint) => setRotateTarget(endpoint),
    openDelete: (endpoint: WebhookEndpoint) => setDeleteTarget(endpoint),
    sendTest,
    testPendingId: test.isPending ? test.variables : undefined,
    dialogs,
  };
}
