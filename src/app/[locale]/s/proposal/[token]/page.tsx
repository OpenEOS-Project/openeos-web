'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, AlertCircle } from '@untitledui/icons';

import { shiftsPublicApi } from '@/lib/api-client';

/**
 * Public landing for a shift-move proposal email link.
 *
 * The admin sends two URLs (?action=accept and ?action=decline) to the
 * helper; this page reads the action from the query string, calls the
 * public proposal endpoint, and renders the outcome.
 *
 * If no `action` is present, both buttons are shown so the page works as a
 * fallback choice screen (e.g. when the email client strips query strings).
 */
export default function ShiftProposalPage() {
  const { token } = useParams() as { token: string };
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action') as 'accept' | 'decline' | null;

  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{ status: 'accepted' | 'declined'; message: string; planSlug: string | null } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (action: 'accept' | 'decline') => {
    setState('loading');
    setErrorMsg(null);
    try {
      const res = await shiftsPublicApi.respondToProposal(token, action);
      setResult({ status: res.data.status, message: res.data.message, planSlug: res.data.planSlug });
      setState('success');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Vorschlag konnte nicht verarbeitet werden.');
      setState('error');
    }
  };

  useEffect(() => {
    if (initialAction === 'accept' || initialAction === 'decline') {
      void submit(initialAction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction, token]);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--paper-2, #f4f4f5)' }}>
      <div style={{ maxWidth: 460, width: '100%', background: 'var(--paper)', borderRadius: 14, padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Image src="/logo_dark.png" alt="OpenEOS" width={140} height={36} style={{ height: 28, width: 'auto' }} />
        </div>

        {state === 'idle' && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, textAlign: 'center' }}>Schichtvorschlag</h1>
            <p style={{ color: 'var(--mute, #666)', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
              Soll deine Schicht wie vorgeschlagen verschoben werden?
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'center' }}>
              <button className="btn btn--primary" onClick={() => submit('accept')}>✓ Annehmen</button>
              <button className="btn btn--ghost" onClick={() => submit('decline')}>✗ Ablehnen</button>
            </div>
          </>
        )}

        {state === 'loading' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite', display: 'inline-block' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {state === 'success' && result && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle style={{ width: 48, height: 48, color: 'var(--green-ink, #10b981)', margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
              {result.status === 'accepted' ? 'Vorschlag angenommen' : 'Vorschlag abgelehnt'}
            </h1>
            <p style={{ color: 'var(--mute, #666)', fontSize: 14, marginTop: 8 }}>{result.message}</p>
            {result.planSlug && (
              <a href={`/s/${result.planSlug}`} className="btn btn--ghost" style={{ marginTop: 20, display: 'inline-block' }}>
                Zur Schicht-Übersicht
              </a>
            )}
          </div>
        )}

        {state === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <AlertCircle style={{ width: 48, height: 48, color: '#dc2626', margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Fehler</h1>
            <p style={{ color: 'var(--mute, #666)', fontSize: 14, marginTop: 8 }}>{errorMsg}</p>
            <button className="btn btn--ghost" style={{ marginTop: 16 }} onClick={() => setState('idle')}>
              Erneut versuchen
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
