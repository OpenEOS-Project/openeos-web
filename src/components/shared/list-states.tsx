'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Inbox } from 'lucide-react';

/** Standard loading state for list pages — centered spinner in an app-card. */
export function ListLoading() {
  const t = useTranslations('common');
  return (
    <div className="app-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div className="spinner" role="status" aria-label={t('loading')} />
    </div>
  );
}

/** Standard error state for list pages with a retry action. */
export function ListError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useTranslations('common');
  return (
    <div
      className="app-card"
      role="alert"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 24px' }}
    >
      <div style={{ color: 'var(--danger)' }}>{message || t('error')}</div>
      <button className="btn btn--ghost" onClick={onRetry || (() => window.location.reload())}>
        {t('retry')}
      </button>
    </div>
  );
}

interface ListEmptyProps {
  title: string;
  description?: string;
  /** Icon rendered inside .empty-state__icon (an SVG or Lucide icon). */
  icon?: ReactNode;
  /** Optional call-to-action, rendered below the description. */
  action?: ReactNode;
}

/** Standard empty state for list pages — uses the .empty-state classes from landing.css. */
export function ListEmpty({ title, description, icon, action }: ListEmptyProps) {
  return (
    <div className="app-card">
      <div className="empty-state">
        <div className="empty-state__icon">
          {icon || <Inbox size={28} />}
        </div>
        <h3 className="empty-state__title">{title}</h3>
        {description && <p className="empty-state__sub">{description}</p>}
        {action}
      </div>
    </div>
  );
}
