'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import { Sun, Moon01, Monitor01, Globe01, Bell01, Check } from '@untitledui/icons';
import { Toggle } from '@/components/ui/toggle/toggle';
import { usePreferences, useUpdatePreferences } from '@/hooks/use-user-settings';
import { cx } from '@/utils/cx';

export function PreferencesSection() {
  const t = useTranslations('settings.preferences');
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const { data: preferences, isLoading } = usePreferences();
  const updatePreferences = useUpdatePreferences();

  const themes = [
    { id: 'light', label: t('theme.light'), icon: Sun },
    { id: 'dark', label: t('theme.dark'), icon: Moon01 },
    { id: 'system', label: t('theme.system'), icon: Monitor01 },
  ];

  const languages = [
    { id: 'de', label: t('language.de') },
    { id: 'en', label: t('language.en') },
  ];

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    await updatePreferences.mutateAsync({ theme: newTheme as 'light' | 'dark' | 'system' });
  };

  const handleLanguageChange = async (newLocale: string) => {
    // Update preference in backend
    await updatePreferences.mutateAsync({ locale: newLocale as 'de' | 'en' });

    // Change URL locale
    const segments = pathname.split('/');
    segments[1] = newLocale; // Replace locale segment
    router.push(segments.join('/'));
  };

  const handleNotificationChange = async (type: 'email' | 'push', enabled: boolean) => {
    await updatePreferences.mutateAsync({
      notifications: {
        [type]: enabled,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-secondary bg-primary shadow-xs p-8">
        <div className="flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <h3 className="text-lg font-semibold text-primary">{t('theme.title')}</h3>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-3">
            {themes.map((themeOption) => {
              const Icon = themeOption.icon;
              const isActive = theme === themeOption.id;

              return (
                <button
                  key={themeOption.id}
                  type="button"
                  onClick={() => handleThemeChange(themeOption.id)}
                  className={cx(
                    'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                    isActive
                      ? 'border-brand-primary bg-brand-primary_alt'
                      : 'border-secondary hover:border-primary hover:bg-secondary'
                  )}
                >
                  {isActive && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-brand-primary" />
                    </div>
                  )}
                  <Icon
                    className={cx(
                      'h-6 w-6',
                      isActive ? 'text-brand-primary' : 'text-tertiary'
                    )}
                  />
                  <span
                    className={cx(
                      'text-sm font-medium',
                      isActive ? 'text-brand-primary' : 'text-secondary'
                    )}
                  >
                    {themeOption.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Language Selection */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <Globe01 className="h-5 w-5 text-tertiary" />
            <h3 className="text-lg font-semibold text-primary">{t('language.title')}</h3>
          </div>
        </div>

        <div className="p-6">
          <div className="flex gap-3">
            {languages.map((lang) => {
              const isActive = locale === lang.id;

              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => handleLanguageChange(lang.id)}
                  className={cx(
                    'relative flex items-center gap-2 rounded-lg border-2 px-4 py-2 transition-all',
                    isActive
                      ? 'border-brand-primary bg-brand-primary_alt'
                      : 'border-secondary hover:border-primary hover:bg-secondary'
                  )}
                >
                  {isActive && (
                    <Check className="h-4 w-4 text-brand-primary" />
                  )}
                  <span
                    className={cx(
                      'text-sm font-medium',
                      isActive ? 'text-brand-primary' : 'text-secondary'
                    )}
                  >
                    {lang.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <Bell01 className="h-5 w-5 text-tertiary" />
            <h3 className="text-lg font-semibold text-primary">{t('notifications.title')}</h3>
          </div>
        </div>

        <div className="divide-y divide-secondary">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-medium text-primary">{t('notifications.email')}</p>
              <p className="text-sm text-tertiary">{t('notifications.emailDescription')}</p>
            </div>
            <Toggle
              isSelected={preferences?.notifications?.email ?? true}
              onChange={(isSelected) => handleNotificationChange('email', isSelected)}
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-medium text-primary">{t('notifications.push')}</p>
              <p className="text-sm text-tertiary">{t('notifications.pushDescription')}</p>
            </div>
            <Toggle
              isSelected={preferences?.notifications?.push ?? false}
              onChange={(isSelected) => handleNotificationChange('push', isSelected)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
