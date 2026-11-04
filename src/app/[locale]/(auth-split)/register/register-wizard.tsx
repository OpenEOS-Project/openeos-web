'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CircleCheck } from 'lucide-react';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { Link } from '@/i18n/routing';
import { authApi } from '@/lib/api-client';
import { useLegalVersions } from '@/hooks/use-legal';

import '@/styles/legal.css';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { CountrySelect } from '@/components/shared/country-select';
import { PlatformLegalLinks } from '@/components/legal/platform-legal-links';
import { countryName } from '@/lib/countries';
import { ApiException } from '@/types/api';

type StepKey = 'account' | 'personal' | 'organization' | 'confirm';
const stepOrder: StepKey[] = ['account', 'personal', 'organization', 'confirm'];

interface FormState {
  email: string;
  password: string;
  passwordConfirm: string;
  /* Voreingestellt aus: ohne Passwort laeuft das Konto ueber Anmeldelinks,
     und eines nachzutragen geht jederzeit in den Einstellungen. */
  mitPasswort: boolean;
  firstName: string;
  lastName: string;
  organizationName: string;
  /* Land der Organisation (Pflicht): steuert die Bargeld-Regel, ändern
     kann es danach nur der Support. */
  country: string;
  /* Beides Pflicht: Die Registrierung schliesst den Vertrag mit OpenEOS
     (AGB und AVV) — nur fuer Unternehmer, Koerperschaften und Vereine. */
  confirmBusiness: boolean;
  acceptTerms: boolean;
  newsletter: boolean;
}

const initial: FormState = {
  email: '',
  password: '',
  passwordConfirm: '',
  mitPasswort: false,
  firstName: '',
  lastName: '',
  organizationName: '',
  country: '',
  confirmBusiness: false,
  acceptTerms: false,
  newsletter: false,
};

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function RegisterWizard() {
  const t = useTranslations('auth.register');
  const tErr = useTranslations('auth.register.errors');
  const apiErrorMessage = useApiErrorMessage();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const legal = useLegalVersions();
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<FormState>(() => ({
    ...initial,
    email: searchParams.get('email') ?? '',
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const redirectUrl = searchParams.get('redirect');

  const step = stepOrder[stepIdx];
  const total = stepOrder.length;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    if (errors[key]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  };

  function validateStep(current: StepKey): boolean {
    const next: typeof errors = {};
    if (current === 'account') {
      if (!data.email) next.email = tErr('required');
      else if (!isEmail(data.email)) next.email = tErr('emailInvalid');
      if (data.mitPasswort) {
        if (!data.password) next.password = tErr('required');
        else if (data.password.length < 8) next.password = tErr('passwordShort');
        else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password))
          next.password = tErr('passwordWeak');
        if (!data.passwordConfirm) next.passwordConfirm = tErr('required');
        else if (data.password !== data.passwordConfirm)
          next.passwordConfirm = tErr('passwordMismatch');
      }
    } else if (current === 'personal') {
      if (!data.firstName) next.firstName = tErr('required');
      else if (data.firstName.trim().length < 2) next.firstName = tErr('nameShort');
      if (!data.lastName) next.lastName = tErr('required');
      else if (data.lastName.trim().length < 2) next.lastName = tErr('nameShort');
    } else if (current === 'organization') {
      if (!data.organizationName) next.organizationName = tErr('required');
      else if (data.organizationName.trim().length < 2)
        next.organizationName = tErr('nameShort');
      if (!data.country) next.country = tErr('countryRequired');
    } else if (current === 'confirm') {
      if (!data.confirmBusiness) next.confirmBusiness = tErr('businessRequired');
      if (!data.acceptTerms) next.acceptTerms = tErr('termsRequired');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    if (stepIdx < total - 1) setStepIdx(stepIdx + 1);
  }

  function goBack() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateStep('confirm')) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      await authApi.register({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        // Leer heisst: Konto ohne Passwort, der Server schickt dann
        // gleich einen Anmeldelink statt der Bestaetigungsmail.
        password: data.mitPasswort ? data.password : undefined,
        organizationName: data.organizationName,
        country: data.country,
        // Frueher nur abgefragt, aber nie mitgeschickt — die API kannte das
        // Feld nicht. Gespeichert wird der Zeitpunkt der Einwilligung.
        newsletterOptIn: data.newsletter,
        confirmBusiness: true,
        acceptTerms: true,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiException) {
        switch (err.code) {
          case 'EMAIL_ALREADY_EXISTS':
          case 'CONFLICT':
            setSubmitError(tErr('emailTaken'));
            break;
          default:
            setSubmitError(apiErrorMessage(err, tErr('generic')));
        }
      } else {
        setSubmitError(tErr('generic'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResendStatus('sending');
    try {
      await authApi.resendVerification(data.email);
    } finally {
      setResendStatus('sent');
    }
  }

  const progress = useMemo(
    () =>
      stepOrder.map((k, i) => ({
        key: k,
        label: t(`steps.${k}.label`),
        idx: i,
      })),
    [t],
  );

  if (done) {
    const loginParams = new URLSearchParams({ email: data.email });
    if (redirectUrl) loginParams.set('redirect', redirectUrl);

    return (
      <div className="wizard wizard--success">
        <span className="wizard__success-icon">
          <CircleCheck />
        </span>
        <h1 className="wizard__title">{t('successTitle')}</h1>
        <p className="wizard__copy">
          {data.mitPasswort
            ? t('successCopy', { email: data.email })
            : t('successCopyLink', { email: data.email })}
        </p>

        {resendStatus === 'sent' ? (
          <p className="auth-hint">{t('resendSent')}</p>
        ) : (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleResend}
            disabled={resendStatus === 'sending'}
          >
            <span>{resendStatus === 'sending' ? '…' : t('resendCta')}</span>
          </button>
        )}

        <Link href={`/login?${loginParams.toString()}`} className="btn btn--primary btn--lg">
          <span>{t('successCta')}</span>
          <ArrowRight />
        </Link>
      </div>
    );
  }

  const stepTitleParts = t(`steps.${step}.title`).split(' ');
  const stepTitleHead = stepTitleParts.slice(0, -1).join(' ');
  const stepTitleTail = stepTitleParts.slice(-1)[0];

  return (
    <form className="wizard" onSubmit={onSubmit} noValidate>
      <div className="wizard__head">
        <span className="wizard__step-label">
          {t('stepLabel', { current: stepIdx + 1, total })}
        </span>
        <h1 className="wizard__title">
          {stepTitleHead && <span>{stepTitleHead}</span>}
          {stepTitleHead && ' '}
          <span className="u-accent">{stepTitleTail}</span>
        </h1>
        <p className="wizard__copy">{t(`steps.${step}.copy`)}</p>
      </div>

      <div className="wizard__progress" aria-label={t('progress')}>
        {progress.map(({ key, label, idx }) => (
          <div
            key={key}
            className={`wizard__progress-step ${
              idx < stepIdx
                ? 'is-done'
                : idx === stepIdx
                  ? 'is-active'
                  : ''
            }`}
          >
            <span className="wizard__progress-dot">
              {idx < stepIdx ? <Check /> : idx + 1}
            </span>
            <span className="wizard__progress-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="wizard__body">
        {step === 'account' && (
          <div className="auth-fields">
            <Field
              label={t('steps.account.email')}
              error={errors.email}
              type="email"
              autoComplete="email"
              value={data.email}
              onChange={(v) => update('email', v)}
            />
            <SettingToggle
              label={t('steps.account.withPassword')}
              hint={t('steps.account.withPasswordHint')}
              checked={data.mitPasswort}
              onChange={(v) => update('mitPasswort', v)}
            />

            {data.mitPasswort && (
              <>
                <Field
                  label={t('steps.account.password')}
                  error={errors.password}
                  type="password"
                  autoComplete="new-password"
                  value={data.password}
                  onChange={(v) => update('password', v)}
                  hint={t('steps.account.passwordHint')}
                />
                <Field
                  label={t('steps.account.passwordConfirm')}
                  error={errors.passwordConfirm}
                  type="password"
                  autoComplete="new-password"
                  value={data.passwordConfirm}
                  onChange={(v) => update('passwordConfirm', v)}
                />
              </>
            )}
          </div>
        )}

        {step === 'personal' && (
          <div className="auth-fields auth-fields--two">
            <Field
              label={t('steps.personal.firstName')}
              error={errors.firstName}
              autoComplete="given-name"
              value={data.firstName}
              onChange={(v) => update('firstName', v)}
            />
            <Field
              label={t('steps.personal.lastName')}
              error={errors.lastName}
              autoComplete="family-name"
              value={data.lastName}
              onChange={(v) => update('lastName', v)}
            />
          </div>
        )}

        {step === 'organization' && (
          <div className="auth-fields">
            <Field
              label={t('steps.organization.name')}
              error={errors.organizationName}
              value={data.organizationName}
              onChange={(v) => update('organizationName', v)}
            />
            <label className={`auth-field ${errors.country ? 'auth-field--error' : ''}`}>
              <span>{t('steps.organization.country')}</span>
              <CountrySelect
                value={data.country}
                onChange={(v) => update('country', v)}
                invalid={!!errors.country}
                className=""
              />
              {errors.country ? (
                <span className="auth-error">{errors.country}</span>
              ) : (
                <span className="auth-hint">{t('steps.organization.countryHint')}</span>
              )}
            </label>
          </div>
        )}

        {step === 'confirm' && (
          <div className="wizard__summary">
            <SummaryRow
              label={t('steps.confirm.summaryAccount')}
              value={data.email}
            />
            <SummaryRow
              label={t('steps.confirm.summaryPersonal')}
              value={`${data.firstName} ${data.lastName}`.trim()}
            />
            <SummaryRow
              label={t('steps.confirm.summaryOrganization')}
              value={data.organizationName}
            />
            <SummaryRow
              label={t('steps.confirm.summaryCountry')}
              value={data.country ? countryName(data.country, locale) : ''}
            />

            <label className="auth-check auth-check--block" data-testid="register-confirm-business">
              <input
                type="checkbox"
                checked={data.confirmBusiness}
                onChange={(e) => update('confirmBusiness', e.target.checked)}
                aria-invalid={!!errors.confirmBusiness}
              />
              <span>{t('steps.confirm.confirmBusiness')}</span>
            </label>
            {errors.confirmBusiness && <span className="auth-error">{errors.confirmBusiness}</span>}

            <label className="auth-check auth-check--block" data-testid="register-accept-terms">
              <input
                type="checkbox"
                checked={data.acceptTerms}
                onChange={(e) => update('acceptTerms', e.target.checked)}
                aria-invalid={!!errors.acceptTerms}
              />
              <span>
                {/* Verlinkt ist die Fassung, die gerade angenommen wird. */}
                {t.rich('steps.confirm.acceptTerms', {
                  agb: (chunks) => (
                    <a href={legal.versionUrl('agb')} target="_blank" rel="noopener noreferrer">
                      {chunks}
                    </a>
                  ),
                  avv: (chunks) => (
                    <a href={legal.versionUrl('avv')} target="_blank" rel="noopener noreferrer">
                      {chunks}
                    </a>
                  ),
                })}
              </span>
            </label>
            {errors.acceptTerms && <span className="auth-error">{errors.acceptTerms}</span>}

            {/* Datenschutz nur zur Kenntnis — eine Einwilligung braucht es
                fuer die Vertragsdaten nicht. */}
            <p className="auth-hint wizard__legal-hint">
              {t.rich('steps.confirm.privacyHint', {
                privacy: (chunks) => (
                  <a href={legal.pageUrl('privacy')} target="_blank" rel="noopener noreferrer">
                    {chunks}
                  </a>
                ),
              })}
              {locale.startsWith('en') && <> {t('steps.confirm.germanNote')}</>}
            </p>

            <label className="auth-check auth-check--block">
              <input
                type="checkbox"
                checked={data.newsletter}
                onChange={(e) => update('newsletter', e.target.checked)}
              />
              <span>{t('steps.confirm.newsletter')}</span>
            </label>

            {submitError && (
              <div className="auth-form__error">{submitError}</div>
            )}
          </div>
        )}
      </div>

      <div className="wizard__nav">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={goBack}
          disabled={stepIdx === 0}
        >
          <ArrowLeft />
          <span>{t('back')}</span>
        </button>

        {stepIdx < total - 1 ? (
          /* Eigene keys: sonst tauscht React beim letzten "Weiter" nur den
             type des Knopfs, und derselbe Klick schickt das Formular ab —
             die Bestaetigungsseite zeigte dann sofort "Bitte akzeptiere
             die Bedingungen". */
          <button key="next" type="button" className="btn btn--primary" onClick={goNext}>
            <span>{t('next')}</span>
            <ArrowRight />
          </button>
        ) : (
          <button
            key="submit"
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
          >
            <span>{submitting ? '…' : t('submit')}</span>
            <ArrowRight />
          </button>
        )}
      </div>

      <p className="auth-form__alt">
        {t('hasAccount')}{' '}
        <Link href="/login" className="auth-form__alt-link">
          {t('login')} →
        </Link>
      </p>
      <PlatformLegalLinks />
    </form>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
}

function Field({
  label,
  error,
  hint,
  type = 'text',
  autoComplete,
  value,
  onChange,
}: FieldProps) {
  return (
    <label className={`auth-field ${error ? 'auth-field--error' : ''}`}>
      <span>{label}</span>
      <input
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span className="auth-error">{error}</span>}
      {!error && hint && <span className="auth-hint">{hint}</span>}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="wizard__summary-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
