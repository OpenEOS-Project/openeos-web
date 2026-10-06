'use client';

import { FormEvent, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Icon } from '@openeos/ui';
import { useLocale, useTranslations } from 'next-intl';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { organizationsApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { UserOrganization } from '@/types/auth';
import { CURRENCIES, LOCALES, TIMEZONES, currencyLabel } from '@/config/org-options';

interface Props {
  open: boolean;
  onClose: () => void;
}

type StepKey = 'basics' | 'settings' | 'confirm';
const stepOrder: StepKey[] = ['basics', 'settings', 'confirm'];

export function CreateOrgModal({ open, onClose }: Props) {
  const t = useTranslations('createOrganization');
  const uiLocale = useLocale();
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
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
      setError(t('nameTooShort'));
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
        apiErrorMessage(err, t('createFailed'));
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const stepLabel = [t('steps.basics'), t('steps.settings'), t('steps.confirm')];

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
              {t('stepOf', { step: step + 1, total })}
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
            aria-label={tCommon('close')}
            style={{
              background: 'transparent',
              border: 0,
              padding: 8,
              cursor: 'pointer',
              color: 'var(--mute)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            <Icon name="x" size={20} />
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
                  {t('basicsIntro')}
                </p>
                <label className="auth-field">
                  <span>{t('name')}</span>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('namePlaceholder')}
                    autoFocus
                  />
                </label>
              </>
            )}

            {currentStep === 'settings' && (
              <>
                <p style={{ margin: 0, color: 'var(--mute)', fontSize: 14 }}>
                  {t('settingsIntro')}
                </p>
                <label className="auth-field">
                  <span>{t('currency')}</span>
                  <select
                    className="select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {CURRENCIES.map((o) => (
                      <option key={o.value} value={o.value}>{currencyLabel(o, uiLocale)}</option>
                    ))}
                  </select>
                </label>
                <label className="auth-field">
                  <span>{t('language')}</span>
                  <select
                    className="select"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                  >
                    {LOCALES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="auth-field">
                  <span>{t('timezone')}</span>
                  <select
                    className="select"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {TIMEZONES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {currentStep === 'confirm' && (
              <>
                <p style={{ margin: 0, color: 'var(--mute)', fontSize: 14 }}>
                  {t('confirmIntro')}
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
                  background: 'color-mix(in oklab, var(--danger) 14%, var(--paper))',
                  color: 'var(--danger-ink)',
                  padding: '10px 12px',
                  borderRadius: 'var(--r)',
                  fontSize: 13,
                  border: '1px solid color-mix(in oklab, var(--danger) 25%, transparent)',
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
              <span>{tCommon('back')}</span>
            </button>
            {step < total - 1 ? (
              <button type="button" className="btn btn--primary" onClick={goNext}>
                <span>{tCommon('next')}</span>
                <Icon name="arrow-right" size={16} />
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn--primary"
                disabled={submitting || name.trim().length < 2}
              >
                {submitting ? (
                  <span>{t('creating')}</span>
                ) : (
                  <>
                    <span>{tCommon('create')}</span>
                    <Icon name="check" size={16} />
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
