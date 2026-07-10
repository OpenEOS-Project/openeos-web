'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAuthStore } from '@/stores/auth-store';
import { useSendSupportMessage, useSupportThread } from '@/hooks/use-support';
import { toast } from '@/components/shared/toast';
import { ListEmpty, ListLoading } from '@/components/shared/list-states';
import { formatChatTimestamp } from '@/utils/format';

export function SupportChat() {
  const t = useTranslations('support');
  const tCommon = useTranslations('common');
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data, isLoading, isError, refetch } = useSupportThread(organizationId);
  const sendMessage = useSendSupportMessage(organizationId);

  const [draft, setDraft] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messages = data?.messages ?? [];

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 76)}px`;
  }, [draft]);

  if (!organizationId) {
    return (
      <ListEmpty
        title="Keine Organisation ausgewählt"
        description="Bitte wählen Sie zuerst eine Organisation aus."
      />
    );
  }

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sendMessage.isPending) return;
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
    <>
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="app-page-head__title">{t('title')}</h1>
            {data?.prioritySupport && <span className="badge badge--success">{t('priorityBadge')}</span>}
          </div>
          <p className="app-page-head__sub">{data?.prioritySupport ? t('priorityHint') : t('standardHint')}</p>
        </div>
      </div>

      {isLoading ? (
        <ListLoading />
      ) : isError ? (
        <div className="app-card" role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 24px' }}>
          <div style={{ color: 'var(--danger)' }}>{tCommon('error')}</div>
          <button className="btn btn--ghost" onClick={() => refetch()}>
            {tCommon('retry')}
          </button>
        </div>
      ) : (
        <div className="app-card chat-card">
          <div className="chat-messages" ref={messagesRef}>
            {messages.length === 0 ? (
              <div className="empty-state" style={{ margin: 'auto' }}>
                <h3 className="empty-state__title">{t('empty.title')}</h3>
                <p className="empty-state__sub">{t('empty.description')}</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-msg ${message.direction === 'inbound' ? 'chat-msg--out' : 'chat-msg--in'}`}
                >
                  <div className="chat-bubble">{message.body}</div>
                  <div className="chat-meta">
                    {message.senderName} · {formatChatTimestamp(message.createdAt)}
                  </div>
                </div>
              ))
            )}
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
        </div>
      )}
    </>
  );
}
