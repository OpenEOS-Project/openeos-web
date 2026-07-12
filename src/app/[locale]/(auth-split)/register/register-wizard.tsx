'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CheckCircle } from '@untitledui/icons';

import { Link } from '@/i18n/routing';
import { authApi } from '@/lib/api-client';
import { ApiException } from '@/types/api';

type StepKey = 'account' | 'personal' | 'organization' | 'confirm';
const stepOrder: StepKey[] = ['account', 'personal', 'organization', 'confirm'];

interface FormState {
  email: string;
  password: string;
  passwordConfirm: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  terms: boolean;
  newsletter: boolean;
}

const initial: FormState = {
  email: '',
  password: '',
  passwordConfirm: '',
  firstName: '',
  lastName: '',
  organizationName: '',
  terms: false,
  newsletter: false,
};

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function RegisterWizard() {
  const t = useTranslations('auth.register');
  const tErr = useTranslations('auth.register.errors');
  const searchParams = useSearchParams();
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
      if (!data.password) next.password = tErr('required');
      else if (data.password.length < 8) next.password = tErr('passwordShort');
      else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password))
        next.password = tErr('passwordWeak');
      if (!data.passwordConfirm) next.passwordConfirm = tErr('required');
      else if (data.password !== data.passwordConfirm)
        next.passwordConfirm = tErr('passwordMismatch');
    } else if (current === 'personal') {
      if (!data.firstName) next.firstName = tErr('required');
      else if (data.firstName.trim().length < 2) next.firstName = tErr('nameShort');
      if (!data.lastName) next.lastName = tErr('required');
      else if (data.lastName.trim().length < 2) next.lastName = tErr('nameShort');
    } else if (current === 'organization') {
      // organization name optional
    } else if (current === 'confirm') {
      if (!data.terms) next.terms = tErr('termsRequired');
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
        password: data.password,
        organizationName: data.organizationName || undefined,
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
            // Validation errors carry the concrete reasons in details, the
            // top-level message is only a generic "Validierung fehlgeschlagen"
            setSubmitError(
              err.details?.length
                ? err.details.map((d) => d.message).join(' · ')
                : err.message,
            );
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
          <CheckCircle />
        </span>
        <h1 className="wizard__title">{t('successTitle')}</h1>
        <p className="wizard__copy">
          {t('successCopy', { email: data.email })}
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

      <div className="wizard__progress" aria-label="Fortschritt">
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
              hint={t('steps.organization.hint')}
              value={data.organizationName}
              onChange={(v) => update('organizationName', v)}
            />
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
              value={data.organizationName || t('steps.confirm.organizationLater')}
            />

            <label className="auth-check auth-check--block">
              <input
                type="checkbox"
                checked={data.terms}
                onChange={(e) => update('terms', e.target.checked)}
              />
              <span>{t('steps.confirm.terms')}</span>
            </label>
            {errors.terms && <span className="auth-error">{errors.terms}</span>}

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
          <button type="button" className="btn btn--primary" onClick={goNext}>
            <span>{t('next')}</span>
            <ArrowRight />
          </button>
        ) : (
          <button
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
