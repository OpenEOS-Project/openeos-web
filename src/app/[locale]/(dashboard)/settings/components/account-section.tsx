'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { useRequestEmailChange, useChangePassword } from '@/hooks/use-user-settings';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { toast } from '@/components/shared/toast';
import { AccountDeletionCard } from '@/components/privacy/account-deletion-card';
import { NewsletterCard } from '@/components/privacy/newsletter-card';
import { SettingsSectionHead } from './settings-section-head';

/* Dieselbe Regel wie in der API (ChangePasswordDto) und bei der
   Registrierung: Groß-, Kleinbuchstabe und Zahl. */
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

/*
 * Factories, damit die Meldungen ueber next-intl uebersetzt werden
 * (t = settings.account.errors). `withPassword`: das Konto hat ein Passwort
 * und muss es zur Bestaetigung eingeben. Konten, die sich nur per
 * Anmeldelink anmelden, haben keins — die API verlangt es dann nicht, und
 * ein Pflichtfeld, das niemand ausfuellen kann, sperrte sie bisher aus.
 */
function createEmailChangeSchema(t: (key: string) => string, withPassword: boolean) {
  return z.object({
    newEmail: z.string().email(t('invalidEmail')),
    password: withPassword ? z.string().min(1, t('passwordRequired')) : z.string().optional(),
  });
}

function createPasswordChangeSchema(t: (key: string) => string, withPassword: boolean) {
  return z.object({
    currentPassword: withPassword ? z.string().min(1, t('currentPasswordRequired')) : z.string().optional(),
    newPassword: z
      .string()
      .min(8, t('passwordTooShort'))
      .max(72, t('passwordTooLong'))
      .regex(PASSWORD_RULE, t('passwordWeak')),
    confirmPassword: z.string().min(1, t('confirmPasswordRequired')),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('passwordMismatch'),
    path: ['confirmPassword'],
  });
}

type EmailChangeFormData = z.infer<ReturnType<typeof createEmailChangeSchema>>;
type PasswordChangeFormData = z.infer<ReturnType<typeof createPasswordChangeSchema>>;

const errorStyle = { fontSize: 12, color: 'var(--danger)', marginTop: 4 } as const;
const footStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  paddingTop: 12,
  borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
} as const;

export function AccountSection() {
  const t = useTranslations('settings.account');
  const tErrors = useTranslations('settings.account.errors');
  const apiErrorMessage = useApiErrorMessage();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  // Ältere API-Versionen kennen das Feld nicht: dann wie bisher fragen.
  const hasPassword = user?.hasPassword !== false;

  const emailChangeSchema = useMemo(() => createEmailChangeSchema(tErrors, hasPassword), [tErrors, hasPassword]);
  const passwordChangeSchema = useMemo(() => createPasswordChangeSchema(tErrors, hasPassword), [tErrors, hasPassword]);

  const requestEmailChange = useRequestEmailChange();
  const changePassword = useChangePassword();

  const emailForm = useForm<EmailChangeFormData>({ resolver: zodResolver(emailChangeSchema) });
  const passwordForm = useForm<PasswordChangeFormData>({ resolver: zodResolver(passwordChangeSchema) });

  const onEmailSubmit = async (data: EmailChangeFormData) => {
    try {
      await requestEmailChange.mutateAsync({
        newEmail: data.newEmail,
        ...(hasPassword && data.password ? { password: data.password } : {}),
      });
      toast.success(t('emailChangeRequested'));
      if (user) setUser({ ...user, pendingEmail: data.newEmail.toLowerCase() });
      emailForm.reset();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const onPasswordSubmit = async (data: PasswordChangeFormData) => {
    try {
      await changePassword.mutateAsync({
        newPassword: data.newPassword,
        ...(hasPassword && data.currentPassword ? { currentPassword: data.currentPassword } : {}),
      });
      toast.success(hasPassword ? t('passwordChanged') : t('passwordSet'));
      // Ab jetzt hat das Konto eins: beim nächsten Mal wird danach gefragt.
      if (user && !hasPassword) setUser({ ...user, hasPassword: true });
      passwordForm.reset();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Email change */}
      <div className="app-card" data-testid="account-email">
        <SettingsSectionHead
          icon="at-sign"
          title={t('changeEmail')}
          description={t('changeEmailDescription', { email: user?.email || '' })}
        />

        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {user?.pendingEmail && (
            <p className="auth-field__hint" style={{ margin: 0 }} data-testid="account-pending-email">
              {t('pendingEmail', { email: user.pendingEmail })}
            </p>
          )}

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="newEmail">{t('newEmail')}</label>
            <input id="newEmail" type="email" autoComplete="email" className="input" {...emailForm.register('newEmail')} />
            {emailForm.formState.errors.newEmail && (
              <p style={errorStyle}>{emailForm.formState.errors.newEmail.message}</p>
            )}
            <span className="auth-field__hint">{t('newEmailHint')}</span>
          </div>

          {hasPassword ? (
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="emailPassword">{t('currentPassword')}</label>
              <input id="emailPassword" type="password" autoComplete="current-password" className="input" {...emailForm.register('password')} />
              {emailForm.formState.errors.password && (
                <p style={errorStyle}>{emailForm.formState.errors.password.message}</p>
              )}
            </div>
          ) : (
            <p className="auth-field__hint" style={{ margin: 0 }} data-testid="account-email-no-password">
              {t('noPasswordEmailHint')}
            </p>
          )}

          <div style={footStyle}>
            <button type="submit" className="btn btn--primary" disabled={requestEmailChange.isPending}>
              {requestEmailChange.isPending ? t('sending') : t('changeEmail')}
            </button>
          </div>
        </form>
      </div>

      {/* Password change / first password */}
      <div className="app-card" data-testid="account-password">
        <SettingsSectionHead
          icon="key-round"
          title={hasPassword ? t('changePassword') : t('setPassword')}
          description={hasPassword ? t('changePasswordDescription') : t('setPasswordDescription')}
        />

        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hasPassword && (
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="currentPassword">{t('currentPassword')}</label>
              <input id="currentPassword" type="password" autoComplete="current-password" className="input" {...passwordForm.register('currentPassword')} />
              {passwordForm.formState.errors.currentPassword && (
                <p style={errorStyle}>{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
          )}

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="newPassword">{t('newPassword')}</label>
            <input id="newPassword" type="password" autoComplete="new-password" className="input" {...passwordForm.register('newPassword')} />
            {passwordForm.formState.errors.newPassword ? (
              <p style={errorStyle}>{passwordForm.formState.errors.newPassword.message}</p>
            ) : (
              <span className="auth-field__hint">{t('passwordRules')}</span>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="confirmPassword">{t('confirmPassword')}</label>
            <input id="confirmPassword" type="password" autoComplete="new-password" className="input" {...passwordForm.register('confirmPassword')} />
            {passwordForm.formState.errors.confirmPassword && (
              <p style={errorStyle}>{passwordForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <div style={footStyle}>
            <button type="submit" className="btn btn--primary" disabled={changePassword.isPending}>
              {changePassword.isPending
                ? t('changing')
                : hasPassword
                  ? t('changePassword')
                  : t('setPassword')}
            </button>
          </div>
        </form>
      </div>

      <NewsletterCard />
      <AccountDeletionCard />
    </div>
  );
}
