'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail01, Lock01, Check } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { InputGroup } from '@/components/ui/input/input-group';
import { FormInput } from '@/components/ui/input/form-input';
import { Label } from '@/components/ui/input/label';
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

  const emailForm = useForm<EmailChangeFormData>({
    resolver: zodResolver(emailChangeSchema),
  });

  const passwordForm = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
  });

  const onEmailSubmit = async (data: EmailChangeFormData) => {
    setEmailSuccess(false);
    try {
      await requestEmailChange.mutateAsync(data);
      setEmailSuccess(true);
      emailForm.reset();
    } catch {
      // Error handling
    }
  };

  const onPasswordSubmit = async (data: PasswordChangeFormData) => {
    setPasswordSuccess(false);
    try {
      await changePassword.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setPasswordSuccess(true);
      passwordForm.reset();
    } catch {
      // Error handling
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Change Section */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <Mail01 className="h-5 w-5 text-tertiary" />
            <h2 className="text-lg font-semibold text-primary">{t('changeEmail')}</h2>
          </div>
          <p className="text-sm text-tertiary mt-1">
            {t('changeEmailDescription', { email: user?.email || '' })}
          </p>
        </div>

        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="p-6 space-y-6">
          {emailSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success-secondary text-success-primary">
              <Check className="h-5 w-5" />
              <p className="text-sm">{t('emailChangeRequested')}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="newEmail">{t('newEmail')}</Label>
            <FormInput
              id="newEmail"
              type="email"
              {...emailForm.register('newEmail')}
              isInvalid={!!emailForm.formState.errors.newEmail}
            />
            {emailForm.formState.errors.newEmail && (
              <p className="text-sm text-error-primary">
                {emailForm.formState.errors.newEmail.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emailPassword">{t('currentPassword')}</Label>
            <FormInput
              id="emailPassword"
              type="password"
              {...emailForm.register('password')}
              isInvalid={!!emailForm.formState.errors.password}
            />
            {emailForm.formState.errors.password && (
              <p className="text-sm text-error-primary">
                {emailForm.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-secondary mt-6">
            <Button
              type="submit"
              disabled={requestEmailChange.isPending}
            >
              {requestEmailChange.isPending ? t('sending') : t('changeEmail')}
            </Button>
          </div>
        </form>
      </div>

      {/* Password Change Section */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <Lock01 className="h-5 w-5 text-tertiary" />
            <h2 className="text-lg font-semibold text-primary">{t('changePassword')}</h2>
          </div>
          <p className="text-sm text-tertiary mt-1">
            {t('changePasswordDescription')}
          </p>
        </div>

        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="p-6 space-y-6">
          {passwordSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success-secondary text-success-primary">
              <Check className="h-5 w-5" />
              <p className="text-sm">{t('passwordChanged')}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
            <FormInput
              id="currentPassword"
              type="password"
              {...passwordForm.register('currentPassword')}
              isInvalid={!!passwordForm.formState.errors.currentPassword}
            />
            {passwordForm.formState.errors.currentPassword && (
              <p className="text-sm text-error-primary">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">{t('newPassword')}</Label>
            <FormInput
              id="newPassword"
              type="password"
              {...passwordForm.register('newPassword')}
              isInvalid={!!passwordForm.formState.errors.newPassword}
            />
            {passwordForm.formState.errors.newPassword && (
              <p className="text-sm text-error-primary">
                {passwordForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
            <FormInput
              id="confirmPassword"
              type="password"
              {...passwordForm.register('confirmPassword')}
              isInvalid={!!passwordForm.formState.errors.confirmPassword}
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="text-sm text-error-primary">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-secondary mt-6">
            <Button
              type="submit"
              disabled={changePassword.isPending}
            >
              {changePassword.isPending ? t('changing') : t('changePassword')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
