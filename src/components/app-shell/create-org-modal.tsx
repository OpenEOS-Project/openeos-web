'use client';

import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from '@untitledui/icons';

import { organizationsApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { UserOrganization } from '@/types/auth';

interface Props {
  open: boolean;
  onClose: () => void;
}

type StepKey = 'basics' | 'settings' | 'confirm';
const stepOrder: StepKey[] = ['basics', 'settings', 'confirm'];

export function CreateOrgModal({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [locale, setLocale] = useState('de-DE');
  const [timezone, setTimezone] = useState('Europe/Berlin');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, organizations, setOrganizations, setCurrentOrganization } = useAuthStore();

  const total = stepOrder.length;
  const currentStep = stepOrder[step];

  const reset = () => {
    setStep(0);
    setName('');
    setCurrency('EUR');
    setLocale('de-DE');
    setTimezone('Europe/Berlin');
    setError(null);
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const goNext = () => {
    setError(null);
    if (currentStep === 'basics' && name.trim().length < 2) {
      setError('Name muss mindestens 2 Zeichen lang sein');
      return;
    }
    if (step < total - 1) setStep(step + 1);
  };

  const goBack = () => {
    setError(null);
    if (step > 0) setStep(step - 1);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await organizationsApi.create({
        name: name.trim(),
        settings: { currency, locale, timezone } as never,
      });
      const created = response.data;
      const newUserOrg: UserOrganization = {
        id: '__pending__',
        userId: user?.id ?? '',
        organizationId: created.id,
        role: 'admin' as never,
        permissions: {} as never,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        organization: created,
      };
      setOrganizations([...organizations, newUserOrg]);
      setCurrentOrganization(newUserOrg);
      reset();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Fehler beim Erstellen der Organisation';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const stepLabel = ['Basisdaten', 'Einstellungen', 'Bestätigung'];

  return (
    <div className="modal__overlay" onClick={close}>
      <div
        className="modal__panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div className="modal__head" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--f-mono, monospace)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                color: 'var(--green-ink)',
                fontWeight: 600,
              }}
            >
              Schritt {step + 1} von {total}
            </div>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '-.02em',
                margin: '6px 0 0',
              }}
            >
              {stepLabel[step]}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Schließen"
            style={{
              background: 'transparent',
              border: 0,
              padding: 8,
              cursor: 'pointer',
              color: 'var(--mute)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${total}, 1fr)`,
            gap: 4,
            padding: '0 24px 8px',
          }}
        >
          {stepOrder.map((_, i) => (
            <div
              key={i}
              style={{
                height: 3,
                borderRadius: 99,
                background:
                  i < step
                    ? 'var(--green-ink)'
                    : i === step
                      ? 'var(--green)'
                      : 'color-mix(in oklab, var(--ink) 12%, transparent)',
                transition: 'background .2s',
              }}
            />
          ))}
        </div>

        <form onSubmit={onSubmit}>
          <div className="modal__body" style={{ display: 'grid', gap: 16 }}>
            {currentStep === 'basics' && (
              <>
                <p style={{ margin: 0, color: 'var(--mute)', fontSize: 14 }}>
                  Wie heißt die Organisation? Du kannst alle weiteren Details später in den
                  Einstellungen anpassen.
                </p>
                <label className="auth-field">
                  <span>Name der Organisation</span>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mein Verein e.V."
                    autoFocus
                  />
                </label>
              </>
            )}

            {currentStep === 'settings' && (
              <>
                <p style={{ margin: 0, color: 'var(--mute)', fontSize: 14 }}>
                  Standard-Einstellungen für Bons, Rechnungen und Anzeige.
                </p>
                <label className="auth-field">
                  <span>Währung</span>
                  <select
                    className="select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="EUR">€ Euro</option>
                    <option value="CHF">CHF Schweizer Franken</option>
                    <option value="USD">$ US Dollar</option>
                  </select>
                </label>
                <label className="auth-field">
                  <span>Sprache</span>
                  <select
                    className="select"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                  >
                    <option value="de-DE">Deutsch (Deutschland)</option>
                    <option value="de-AT">Deutsch (Österreich)</option>
                    <option value="de-CH">Deutsch (Schweiz)</option>
                    <option value="en-US">English (US)</option>
                  </select>
                </label>
                <label className="auth-field">
                  <span>Zeitzone</span>
                  <select
                    className="select"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="Europe/Berlin">Europe/Berlin</option>
                    <option value="Europe/Vienna">Europe/Vienna</option>
                    <option value="Europe/Zurich">Europe/Zurich</option>
                    <option value="UTC">UTC</option>
                  </select>
                </label>
              </>
            )}

            {currentStep === 'confirm' && (
              <>
                <p style={{ margin: 0, color: 'var(--mute)', fontSize: 14 }}>
                  Überprüfe deine Angaben. Du wirst nach dem Erstellen automatisch zur neuen
                  Organisation gewechselt.
                </p>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 'var(--r)',
                    background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.01em' }}>
                    {name || '—'}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--f-mono, monospace)',
                      fontSize: 12,
                      color: 'var(--mute)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <span>{currency}</span>
                    <span>·</span>
                    <span>{locale}</span>
                    <span>·</span>
                    <span>{timezone}</span>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div
                style={{
                  background: 'color-mix(in oklab, #d24545 14%, var(--paper))',
                  color: '#8a1f1f',
                  padding: '10px 12px',
                  borderRadius: 'var(--r)',
                  fontSize: 13,
                  border: '1px solid color-mix(in oklab, #d24545 25%, transparent)',
                }}
              >
                {error}
              </div>
            )}
          </div>

          <div className="modal__foot">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={goBack}
              disabled={step === 0 || submitting}
            >
              <ArrowLeft style={{ width: 16, height: 16 }} />
              <span>Zurück</span>
            </button>
            {step < total - 1 ? (
              <button type="button" className="btn btn--primary" onClick={goNext}>
                <span>Weiter</span>
                <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn--primary"
                disabled={submitting || name.trim().length < 2}
              >
                {submitting ? (
                  <span>Erstelle…</span>
                ) : (
                  <>
                    <span>Erstellen</span>
                    <Check style={{ width: 16, height: 16 }} />
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
