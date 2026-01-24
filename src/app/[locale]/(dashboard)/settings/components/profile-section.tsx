'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera01, Trash01 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { InputGroup } from '@/components/ui/input/input-group';
import { Input } from '@/components/ui/input/input';
import { FormInput } from '@/components/ui/input/form-input';
import { Label } from '@/components/ui/input/label';
import { Avatar } from '@/components/ui/avatar/avatar';
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

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile.mutateAsync(data);
    } catch {
      // Error handling done by mutation
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadAvatar.mutateAsync(file);
      if (user) {
        setUser({ ...user, avatarUrl: result.avatarUrl });
      }
    } catch {
      // Error handling
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      await deleteAvatar.mutateAsync();
      if (user) {
        setUser({ ...user, avatarUrl: null });
      }
    } catch {
      // Error handling
    }
  };

  return (
    <div className="rounded-xl border border-secondary bg-primary shadow-xs">
      <div className="border-b border-secondary px-6 py-4">
        <h2 className="text-lg font-semibold text-primary">{t('title')}</h2>
        <p className="text-sm text-tertiary">{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar
              size="2xl"
              src={user?.avatarUrl || undefined}
              alt={`${user?.firstName} ${user?.lastName}`}
              className="ring-4 ring-secondary"
            />
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={isUploading}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary border border-secondary shadow-sm hover:bg-secondary transition-colors"
            >
              <Camera01 className="h-4 w-4 text-secondary" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">{t('avatar')}</p>
            <p className="text-sm text-tertiary">{t('avatarDescription')}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                color="secondary"
                size="sm"
                onClick={handleAvatarClick}
                disabled={isUploading}
              >
                {t('uploadAvatar')}
              </Button>
              {user?.avatarUrl && (
                <Button
                  type="button"
                  color="tertiary"
                  size="sm"
                  onClick={handleDeleteAvatar}
                  disabled={deleteAvatar.isPending}
                >
                  <Trash01 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Name Fields */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">{t('firstName')}</Label>
            <FormInput
              id="firstName"
              {...register('firstName')}
              isInvalid={!!errors.firstName}
            />
            {errors.firstName && (
              <p className="text-sm text-error-primary">{errors.firstName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lastName">{t('lastName')}</Label>
            <FormInput
              id="lastName"
              {...register('lastName')}
              isInvalid={!!errors.lastName}
            />
            {errors.lastName && (
              <p className="text-sm text-error-primary">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            value={user?.email || ''}
            isDisabled
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t border-secondary">
          <Button
            type="submit"
            disabled={!isDirty || updateProfile.isPending}
          >
            {updateProfile.isPending ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  );
}
