'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateProfile, useUploadAvatar, useDeleteAvatar } from '@/hooks/use-user-settings';

const profileSchema = z.object({
  firstName: z.string().min(1, 'Vorname ist erforderlich'),
  lastName: z.string().min(1, 'Nachname ist erforderlich'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileSection() {
  const t = useTranslations('settings.profile');
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try { await updateProfile.mutateAsync(data); } catch { /* handled by mutation */ }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadAvatar.mutateAsync(file);
      if (user) setUser({ ...user, avatarUrl: result.avatarUrl });
    } catch { /* handled */ } finally { setIsUploading(false); }
  };

  const handleDeleteAvatar = async () => {
    try {
      await deleteAvatar.mutateAsync();
      if (user) setUser({ ...user, avatarUrl: null });
    } catch { /* handled */ }
  };

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="app-card">
      <div className="app-card__head" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>{t('title')}</h2>
          <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('description')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={initials} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                color: 'var(--green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700,
              }}>
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 22, height: 22, borderRadius: '50%',
                border: '2px solid var(--paper)',
                background: 'color-mix(in oklab, var(--ink) 12%, transparent)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" style={{ display: 'none' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('avatar')}</span>
            <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('avatarDescription')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {t('uploadAvatar')}
              </button>
              {user?.avatarUrl && (
                <button type="button" className="btn btn--ghost" style={{ fontSize: 12, color: 'var(--red, #dc2626)' }} onClick={handleDeleteAvatar} disabled={deleteAvatar.isPending}>
                  {t('deleteAvatar') ?? 'Löschen'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Name fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="firstName">{t('firstName')}</label>
            <input id="firstName" className="input" {...register('firstName')} />
            {errors.firstName && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.firstName.message}</p>}
          </div>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="lastName">{t('lastName')}</label>
            <input id="lastName" className="input" {...register('lastName')} />
            {errors.lastName && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.lastName.message}</p>}
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="email">{t('email')}</label>
          <input id="email" type="email" className="input" value={user?.email || ''} disabled readOnly />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
          <button type="submit" className="btn btn--primary" disabled={!isDirty || updateProfile.isPending}>
            {updateProfile.isPending ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
}
