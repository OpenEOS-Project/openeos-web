'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAdminSendSupportMessage, useAdminSupportMessages, useAdminSupportThreads } from '@/hooks/use-support';
import { ListError, ListLoading } from '@/components/shared/list-states';
import { toast } from '@/components/shared/toast';
import { formatChatTimestamp } from '@/utils/format';

export function AdminSupportContainer() {
  const t = useTranslations('admin.support');
  const tCommon = useTranslations('common');

  const { data: threads, isLoading, isError, refetch } = useAdminSupportThreads();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: messages } = useAdminSupportMessages(selectedOrgId ?? undefined);
  const sendMessage = useAdminSendSupportMessage(selectedOrgId ?? undefined);

  const [draft, setDraft] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 76)}px`;
  }, [draft]);

  if (isLoading) return <ListLoading />;
  if (isError) return <ListError onRetry={() => refetch()} />;

  const selectedThread = threads?.find((thread) => thread.organizationId === selectedOrgId) ?? null;

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !selectedOrgId || sendMessage.isPending) return;
    try {
      await sendMessage.mutateAsync(body);
      setDraft('');
    } catch {
      toast.error(tCommon('saveFailed'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="support-layout">
      <div className="app-card support-threads">
        {!threads || threads.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--mute)', fontSize: 14 }}>{t('threadListEmpty')}</div>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.organizationId}
              type="button"
              className={`support-thread${thread.organizationId === selectedOrgId ? ' support-thread--active' : ''}`}
              onClick={() => setSelectedOrgId(thread.organizationId)}
            >
              <div className="support-thread__row">
                <span className="support-thread__name">
                  {thread.prioritySupport && '🚀 '}
                  {thread.organizationName}
                </span>
                {thread.unreadCount > 0 && <span className="badge badge--error">{thread.unreadCount}</span>}
              </div>
              {thread.lastMessagePreview && (
                <span className="support-thread__preview">{thread.lastMessagePreview}</span>
              )}
              {thread.lastMessageAt && (
                <span className="support-thread__meta">{formatChatTimestamp(thread.lastMessageAt)}</span>
              )}
            </button>
          ))
        )}
      </div>

      <div className="app-card chat-card">
        {!selectedThread ? (
          <div className="empty-state" style={{ margin: 'auto' }}>
            <h3 className="empty-state__title">{t('noThreadSelected')}</h3>
          </div>
        ) : (
          <>
            <div className="chat-messages" ref={messagesRef}>
              {(messages ?? []).map((message) => (
                <div
                  key={message.id}
                  className={`chat-msg ${message.direction === 'outbound' ? 'chat-msg--out' : 'chat-msg--in'}`}
                >
                  <div className="chat-bubble">{message.body}</div>
                  <div className="chat-meta">
                    {message.senderName} · {formatChatTimestamp(message.createdAt)}
                  </div>
                </div>
              ))}
            </div>

            <div className="chat-input-row">
              <textarea
                ref={textareaRef}
                className="input chat-textarea"
                rows={1}
                placeholder={t('input.placeholder')}
                value={draft}
                maxLength={2000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                className="btn btn--primary"
                disabled={!draft.trim() || sendMessage.isPending}
                onClick={handleSend}
              >
                {t('input.send')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
