'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Toast } from '@openeos/ui';
import type { BroadcastMessage } from '@/hooks/use-device-socket';

interface BroadcastToastProps {
  messages: BroadcastMessage[];
  onDismiss: (id: string) => void;
}

/** Durchsagen aus der Verwaltung, oben mittig über allem. */
export function BroadcastToast({ messages, onDismiss }: BroadcastToastProps) {
  if (messages.length === 0) return null;
  return (
    <div className="pos-broadcasts" aria-live="assertive">
      {messages.map((message) => (
        <BroadcastItem key={message.id} message={message} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function BroadcastItem({ message, onDismiss }: { message: BroadcastMessage; onDismiss: (id: string) => void }) {
  const t = useTranslations('deviceUi.common');

  useEffect(() => {
    if (!message.duration || message.duration <= 0) return;
    const timer = window.setTimeout(() => onDismiss(message.id), message.duration);
    return () => window.clearTimeout(timer);
  }, [message.id, message.duration, onDismiss]);

  const tone = message.type === 'error' || message.type === 'warning' ? 'danger' : 'success';
  return (
    <Toast
      tone={tone}
      title={message.title || message.message}
      onDismiss={() => onDismiss(message.id)}
      dismissLabel={t('dismiss')}
    >
      {message.title ? message.message : null}
      {message.senderName ? ` · ${t('from', { name: message.senderName })}` : null}
    </Toast>
  );
}
