'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle, InfoCircle } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import type { BroadcastMessage } from '@/hooks/use-device-socket';

interface BroadcastToastProps {
  messages: BroadcastMessage[];
  onDismiss: (id: string) => void;
}

const typeStyles = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-900 dark:text-blue-100',
    text: 'text-blue-800 dark:text-blue-200',
  },
  warning: {
    bg: 'bg-warning-secondary',
    border: 'border-warning-primary/30',
    icon: 'text-warning-primary',
    title: 'text-warning-primary',
    text: 'text-primary',
  },
  success: {
    bg: 'bg-success-secondary',
    border: 'border-success-primary/30',
    icon: 'text-success-primary',
    title: 'text-success-primary',
    text: 'text-primary',
  },
  error: {
    bg: 'bg-error-secondary',
    border: 'border-error-primary/30',
    icon: 'text-error-primary',
    title: 'text-error-primary',
    text: 'text-primary',
  },
};

const typeIcons = {
  info: InfoCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertCircle,
};

export function BroadcastToast({ messages, onDismiss }: BroadcastToastProps) {
  if (messages.length === 0) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-lg px-4">
      {messages.map((message) => (
        <BroadcastToastItem
          key={message.id}
          message={message}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

interface BroadcastToastItemProps {
  message: BroadcastMessage;
  onDismiss: (id: string) => void;
}

function BroadcastToastItem({ message, onDismiss }: BroadcastToastItemProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss after duration (if not persistent)
    if (message.duration && message.duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss(message.id), 300);
      }, message.duration);
      return () => clearTimeout(timer);
    }
  }, [message.id, message.duration, onDismiss]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onDismiss(message.id), 300);
  }, [message.id, onDismiss]);

  const styles = typeStyles[message.type];
  const Icon = typeIcons[message.type];

  return (
    <div
      className={cx(
        'flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-all duration-300',
        styles.bg,
        styles.border,
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      )}
    >
      <Icon className={cx('h-5 w-5 shrink-0 mt-0.5', styles.icon)} />

      <div className="flex-1 min-w-0">
        {message.title && (
          <p className={cx('font-semibold', styles.title)}>
            {message.title}
          </p>
        )}
        <p className={cx('text-sm', styles.text, message.title && 'mt-1')}>
          {message.message}
        </p>
        {message.senderName && (
          <p className="text-xs text-tertiary mt-2">
            Von: {message.senderName}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-lg p-1 text-tertiary hover:bg-black/5 dark:hover:bg-white/5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
