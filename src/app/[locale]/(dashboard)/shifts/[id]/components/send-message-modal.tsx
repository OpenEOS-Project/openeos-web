'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import type { ShiftPlan } from '@/types/shift';

interface SendMessageModalProps {
  open: boolean;
  plan: ShiftPlan;
  /** Single-helper mode: deliver only to this helper. Omit/null = send to all
   *  helpers in the plan who have an email address. */
  helper?: { name: string; email: string | null } | null;
  /** Distinct helper emails in the plan — used to show the recipient count in
   *  the "send to all" mode. */
  allHelperEmails?: string[];
  onClose: () => void;
}

// Tokens are replaced server-side per helper — they are part of the API
// contract and therefore stay the same in every UI language.
const TOKEN_NAME = '{{name}}';
const TOKEN_SHIFTS = '{{schichten}}';
const TOKEN_PLAN = '{{plan}}';

export function SendMessageModal({ open, plan, helper, allHelperEmails = [], onClose }: SendMessageModalProps) {
  const t = useTranslations();
  const tm = useTranslations('shifts.sendMessage');
  const apiErrorMessage = useApiErrorMessage();
  const PLACEHOLDERS: Array<{ token: string; label: string }> = [
    { token: TOKEN_NAME, label: tm('placeholderName') },
    { token: TOKEN_SHIFTS, label: tm('placeholderShifts') },
    { token: TOKEN_PLAN, label: tm('placeholderPlan') },
  ];
  const DEFAULT_TEMPLATE = tm('defaultTemplate', { name: TOKEN_NAME, plan: TOKEN_PLAN, shifts: TOKEN_SHIFTS });
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState(DEFAULT_TEMPLATE);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; recipients: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSingle = !!helper;
  const recipientCount = isSingle ? (helper?.email ? 1 : 0) : allHelperEmails.length;

  useEffect(() => {
    if (!open) return;
    setSubject('');
    setMessage(DEFAULT_TEMPLATE);
    setError(null);
    setResult(null);
  }, [open, DEFAULT_TEMPLATE]);

  const sendMutation = useMutation({
    mutationFn: () =>
      shiftsApi.broadcastMessage(organizationId!, plan.id, {
        message,
        subject: subject.trim() || undefined,
        recipientEmails: isSingle && helper?.email ? [helper.email] : undefined,
      }),
    onSuccess: (res) => {
      const data = res.data;
      // Auto-close on a clean single-recipient send; for broadcasts show the
      // delivery summary so the admin sees how many mails went out.
      if (isSingle) {
        onClose();
      } else {
        setResult(data);
      }
    },
    onError: (err: Error) => setError(apiErrorMessage(err, t('common.error'))),
  });

  const insertPlaceholder = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setMessage((m) => m + token);
      return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    // Restore caret just after the inserted token on the next tick.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleClose = () => { onClose(); };
  if (!open) return null;

  const canSend = message.trim().length > 0 && recipientCount > 0 && !sendMutation.isPending;

  return (
    <div className="modal__backdrop" onClick={handleClose}>
      <div className="modal__box modal__panel--md" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">
            {isSingle ? tm('titleSingle', { name: helper?.name ?? '' }) : tm('titleAll')}
          </div>
          <DialogCloseButton onClick={handleClose} />
        </div>

        <div className="modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div role="alert" style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 12%, transparent)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            {result ? (
              <div style={{ padding: 14, borderRadius: 8, background: 'color-mix(in oklab, var(--green-ink) 12%, transparent)', color: 'var(--green-ink)', fontSize: 14, fontWeight: 600 }}>
                {tm('result', { sent: result.sent, recipients: result.recipients })}
              </div>
            ) : (
              <>
                {/* Recipient summary */}
                <div style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                  {isSingle ? (
                    tm.rich('recipientSingle', {
                      name: helper?.name ?? '',
                      email: helper?.email || tm('noEmail'),
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })
                  ) : (
                    tm.rich('recipientAll', {
                      count: recipientCount,
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })
                  )}
                </div>

                {recipientCount === 0 && (
                  <div style={{ padding: 10, borderRadius: 8, background: 'color-mix(in oklab, var(--warn) 12%, transparent)', color: 'var(--warn-ink)', fontSize: 13 }}>
                    {isSingle
                      ? tm('noEmailSingle')
                      : tm('noEmailAll')}
                  </div>
                )}

                {/* Subject */}
                <div className="auth-field">
                  <label className="auth-field__label">{tm('subject')}</label>
                  <input
                    className="input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={tm('subjectPlaceholder', { plan: plan.name })}
                  />
                </div>

                {/* Message */}
                <div className="auth-field">
                  <label className="auth-field__label">{tm('message')}</label>
                  <textarea
                    ref={textareaRef}
                    className="textarea"
                    rows={9}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                {/* Placeholder helper */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{tm('insertPlaceholder')}</span>
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.token}
                      type="button"
                      onClick={() => insertPlaceholder(p.token)}
                      style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--f-mono)',
                        border: '1px solid color-mix(in oklab, var(--ink) 14%, transparent)',
                        background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
                        cursor: 'pointer', color: 'var(--ink)',
                      }}
                      title={`${p.token} → ${p.label}`}
                    >
                      {p.token}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', margin: 0 }}>
                  {tm.rich('placeholdersHint', {
                    token: TOKEN_SHIFTS,
                    code: (chunks) => <code>{chunks}</code>,
                  })}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            {result ? t('common.close') : t('common.cancel')}
          </button>
          {!result && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canSend}
              onClick={() => { setError(null); sendMutation.mutate(); }}
            >
              {sendMutation.isPending
                ? tm('sending')
                : isSingle
                ? tm('send')
                : tm('sendToCount', { count: recipientCount })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
