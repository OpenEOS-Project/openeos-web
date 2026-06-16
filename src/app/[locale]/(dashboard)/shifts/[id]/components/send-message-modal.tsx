'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
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

const PLACEHOLDERS: Array<{ token: string; label: string }> = [
  { token: '{{name}}', label: 'Name' },
  { token: '{{schichten}}', label: 'Schichten' },
  { token: '{{plan}}', label: 'Plan' },
];

const DEFAULT_TEMPLATE =
  'Hallo {{name}},\n\n' +
  'hier deine eingetragenen Schichten für {{plan}}:\n\n' +
  '{{schichten}}\n\n' +
  'Bitte sei pünktlich da. Vielen Dank für deine Hilfe!';

export function SendMessageModal({ open, plan, helper, allHelperEmails = [], onClose }: SendMessageModalProps) {
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
  }, [open]);

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
    onError: (err: Error) => setError(err.message || 'Ein Fehler ist aufgetreten'),
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
      <div className="modal__box" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">
            {isSingle ? `Nachricht an ${helper?.name}` : 'Nachricht an alle Helfer'}
          </div>
          <button className="modal__close" onClick={handleClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, #dc2626 12%, transparent)', color: '#dc2626', fontSize: 13 }}>{error}</div>
            )}

            {result ? (
              <div style={{ padding: 14, borderRadius: 8, background: 'color-mix(in oklab, var(--green-ink) 12%, transparent)', color: 'var(--green-ink)', fontSize: 14, fontWeight: 600 }}>
                {result.sent} von {result.recipients} {result.recipients === 1 ? 'Helfer' : 'Helfern'} per E-Mail benachrichtigt.
              </div>
            ) : (
              <>
                {/* Recipient summary */}
                <div style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                  {isSingle ? (
                    <>Empfänger: <strong>{helper?.name}</strong> ({helper?.email || 'ohne E-Mail'})</>
                  ) : (
                    <>Empfänger: <strong>{recipientCount}</strong> {recipientCount === 1 ? 'Helfer' : 'Helfer'} mit E-Mail-Adresse</>
                  )}
                </div>

                {recipientCount === 0 && (
                  <div style={{ padding: 10, borderRadius: 8, background: 'color-mix(in oklab, #d97706 12%, transparent)', color: '#b45309', fontSize: 13 }}>
                    {isSingle
                      ? 'Dieser Helfer hat keine E-Mail-Adresse — eine Nachricht kann nicht zugestellt werden.'
                      : 'Kein Helfer hat eine E-Mail-Adresse hinterlegt.'}
                  </div>
                )}

                {/* Subject */}
                <div className="auth-field">
                  <label className="auth-field__label">Betreff (optional)</label>
                  <input
                    className="input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={`Info zu: ${plan.name}`}
                  />
                </div>

                {/* Message */}
                <div className="auth-field">
                  <label className="auth-field__label">Nachricht</label>
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
                  <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>Platzhalter einfügen:</span>
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
                  Die Platzhalter werden pro Helfer ersetzt — <code>{'{{schichten}}'}</code> fügt die jeweils eingetragenen Schichten als Liste ein.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            {result ? 'Schließen' : 'Abbrechen'}
          </button>
          {!result && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canSend}
              onClick={() => { setError(null); sendMutation.mutate(); }}
            >
              {sendMutation.isPending
                ? '...'
                : isSingle
                ? 'Senden'
                : `An ${recipientCount} Helfer senden`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
