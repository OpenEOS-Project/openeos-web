'use client';

import { useMemo, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateProfile, useUploadAvatar, useDeleteAvatar } from '@/hooks/use-user-settings';
import { resolveUploadUrl } from '@/utils/upload-url';
import { toast } from '@/components/shared/toast';

function createProfileSchema(t: (key: string) => string) {
  return z.object({
    firstName: z.string().min(1, t('firstNameRequired')),
    lastName: z.string().min(1, t('lastNameRequired')),
  });
}

type ProfileFormData = z.infer<ReturnType<typeof createProfileSchema>>;

export function ProfileSection() {
  const t = useTranslations('settings.profile');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('settings.profile.errors');
  const profileSchema = useMemo(() => createProfileSchema(tErrors), [tErrors]);
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile.mutateAsync(data);
      // Setzt die als "dirty" erkannten Werte auf die gerade gespeicherten
      // zurueck, sonst bleibt der Speichern-Button nach Erfolg aktiv.
      reset(data);
    } catch { /* handled by mutation */ }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadAvatar.mutateAsync(file);
      if (user) setUser({ ...user, avatarUrl: result.avatarUrl });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      await deleteAvatar.mutateAsync();
      if (user) setUser({ ...user, avatarUrl: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('removeFailed'));
    }
  };

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="app-card">
      <div className="app-card__head" style={{ display: 'block' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t('title')}</h2>
        <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', margin: '4px 0 0' }}>{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="app-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0 }}>
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveUploadUrl(user.avatarUrl)} alt={initials} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)' }} />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                  color: 'var(--green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 700,
                  border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                }}>
                  {initials || '?'}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: '1 1 200px' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t('avatar')}</span>
              <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                {t('avatarDescription')}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  style={{ fontSize: 12 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? tCommon('saving') : user?.avatarUrl ? t('replaceAvatar') : t('uploadAvatar')}
                </button>
                {user?.avatarUrl && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: 12, color: 'var(--red, var(--danger))' }}
                    onClick={handleDeleteAvatar}
                    disabled={deleteAvatar.isPending}
                  >
                    {t('deleteAvatar')}
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileChange} style={{ display: 'none' }} />
            </div>
          </div>

          {/* Name fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="firstName">{t('firstName')}</label>
              <input id="firstName" className="input" {...register('firstName')} />
              {errors.firstName && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.firstName.message}</p>}
            </div>
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="lastName">{t('lastName')}</label>
              <input id="lastName" className="input" {...register('lastName')} />
              {errors.lastName && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.lastName.message}</p>}
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="email">{t('email')}</label>
            <input id="email" type="email" className="input" value={user?.email || ''} disabled readOnly />
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '14px 20px',
          borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
        }}>
          <button type="submit" className="btn btn--primary" disabled={!isDirty || updateProfile.isPending}>
            {updateProfile.isPending ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
}
