'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Mail01, CheckCircle } from '@untitledui/icons';

import { shiftsPublicApi } from '@/lib/api-client';

/**
 * Public entry-point for the helper self-service flow. Helper enters their
 * email, we POST to /request-magic-link, the server (silently) issues a 24h
 * token and mails it. We always show the same success message so the page
 * doesn't leak which addresses are registered.
 */
export default function HelperManageRequestPage() {
  const { slug } = useParams() as { slug: string };
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await shiftsPublicApi.requestHelperMagicLink(slug, email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message || 'Anfrage fehlgeschlagen.');
    } finally {
      setPending(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--paper-2, #f4f4f5)' }}>
      <div style={{ maxWidth: 460, width: '100%', background: 'var(--paper)', borderRadius: 14, padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Image src="/logo_dark.png" alt="OpenEOS" width={140} height={36} style={{ height: 28, width: 'auto' }} />
        </div>

        {!sent ? (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, textAlign: 'center' }}>Meine Schichten verwalten</h1>
            <p style={{ color: 'var(--mute, #666)', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
              Gib die E-Mail-Adresse ein, mit der du dich angemeldet hast. Wir schicken dir einen Link, mit dem du deine Schichten ansehen und anpassen kannst.
            </p>

            <form onSubmit={submit} style={{ marginTop: 20 }}>
              <div className="auth-field">
                <label className="auth-field__label">E-Mail *</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="max@example.com"
                  autoFocus
                />
              </div>
              {error && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'color-mix(in oklab, #dc2626 12%, transparent)', color: '#dc2626', fontSize: 13 }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="btn btn--primary"
                style={{ width: '100%', marginTop: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                disabled={pending}
              >
                <Mail01 style={{ width: 16, height: 16 }} />
                <span>{pending ? '...' : 'Link senden'}</span>
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle style={{ width: 48, height: 48, color: 'var(--green-ink, #10b981)', margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>E-Mail versendet</h1>
            <p style={{ color: 'var(--mute, #666)', fontSize: 14, marginTop: 8 }}>
              Falls es eine Anmeldung mit dieser E-Mail-Adresse gibt, ist der Link unterwegs. Schau auch im Spam-Ordner nach.
            </p>
            <a href={`/s/${slug}`} className="btn btn--ghost" style={{ marginTop: 20, display: 'inline-block' }}>
              Zurück zum Schichtplan
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
