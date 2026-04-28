'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { useRequestEmailChange, useChangePassword } from '@/hooks/use-user-settings';

const emailChangeSchema = z.object({
  newEmail: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Aktuelles Passwort ist erforderlich'),
  newPassword: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben'),
  confirmPassword: z.string().min(1, 'Passwort-Bestätigung ist erforderlich'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
});

type EmailChangeFormData = z.infer<typeof emailChangeSchema>;
type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

export function AccountSection() {
  const t = useTranslations('settings.account');
  const { user } = useAuthStore();
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const requestEmailChange = useRequestEmailChange();
  const changePassword = useChangePassword();

  const emailForm = useForm<EmailChangeFormData>({ resolver: zodResolver(emailChangeSchema) });
  const passwordForm = useForm<PasswordChangeFormData>({ resolver: zodResolver(passwordChangeSchema) });

  const onEmailSubmit = async (data: EmailChangeFormData) => {
    setEmailSuccess(false);
    try {
      await requestEmailChange.mutateAsync(data);
      setEmailSuccess(true);
      emailForm.reset();
    } catch { /* handled */ }
  };

  const onPasswordSubmit = async (data: PasswordChangeFormData) => {
    setPasswordSuccess(false);
    try {
      await changePassword.mutateAsync({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      setPasswordSuccess(true);
      passwordForm.reset();
    } catch { /* handled */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Email change */}
      <div className="app-card">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t('changeEmail')}</h2>
          <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
            {t('changeEmailDescription', { email: user?.email || '' })}
          </p>
        </div>

        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {emailSuccess && (
            <div style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, #22c55e 12%, transparent)', color: '#15803d', fontSize: 13 }}>
              {t('emailChangeRequested')}
            </div>
          )}

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="newEmail">{t('newEmail')}</label>
            <input id="newEmail" type="email" className="input" {...emailForm.register('newEmail')} />
            {emailForm.formState.errors.newEmail && (
              <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{emailForm.formState.errors.newEmail.message}</p>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="emailPassword">{t('currentPassword')}</label>
            <input id="emailPassword" type="password" className="input" {...emailForm.register('password')} />
            {emailForm.formState.errors.password && (
              <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{emailForm.formState.errors.password.message}</p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
            <button type="submit" className="btn btn--primary" disabled={requestEmailChange.isPending}>
              {requestEmailChange.isPending ? t('sending') : t('changeEmail')}
            </button>
          </div>
        </form>
      </div>

      {/* Password change */}
      <div className="app-card">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t('changePassword')}</h2>
          <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('changePasswordDescription')}</p>
        </div>

        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {passwordSuccess && (
            <div style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, #22c55e 12%, transparent)', color: '#15803d', fontSize: 13 }}>
              {t('passwordChanged')}
            </div>
          )}

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="currentPassword">{t('currentPassword')}</label>
            <input id="currentPassword" type="password" className="input" {...passwordForm.register('currentPassword')} />
            {passwordForm.formState.errors.currentPassword && (
              <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{passwordForm.formState.errors.currentPassword.message}</p>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="newPassword">{t('newPassword')}</label>
            <input id="newPassword" type="password" className="input" {...passwordForm.register('newPassword')} />
            {passwordForm.formState.errors.newPassword && (
              <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{passwordForm.formState.errors.newPassword.message}</p>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="confirmPassword">{t('confirmPassword')}</label>
            <input id="confirmPassword" type="password" className="input" {...passwordForm.register('confirmPassword')} />
            {passwordForm.formState.errors.confirmPassword && (
              <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{passwordForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
            <button type="submit" className="btn btn--primary" disabled={changePassword.isPending}>
              {changePassword.isPending ? t('changing') : t('changePassword')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
