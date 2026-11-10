'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { Icon } from '@openeos/ui';
import { useRouter, usePathname } from '@/i18n/routing';
import { usePreferences, useUpdatePreferences } from '@/hooks/use-user-settings';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { ListLoading } from '@/components/shared/list-states';
import { SettingsSectionHead } from './settings-section-head';

export function PreferencesSection() {
  const t = useTranslations('settings.preferences');
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const { data: preferences, isLoading } = usePreferences();
  const updatePreferences = useUpdatePreferences();

  const themes = [
    { id: 'light', label: t('theme.light') },
    { id: 'dark', label: t('theme.dark') },
    { id: 'system', label: t('theme.system') },
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
    await updatePreferences.mutateAsync({ locale: newLocale as 'de' | 'en' });
    /* Ueber den Router von next-intl, wie im Kontomenue der Seitenleiste.
       Das fruehere Ersetzen des ersten Pfadsegments ging von einem
       Sprachpraefix aus — das Deutsche hat aber keines ("as-needed"), und
       aus /settings wurde /en, also das Dashboard. */
    router.replace(pathname, { locale: newLocale as 'de' | 'en' });
  };

  const handleNotificationChange = async (type: 'email' | 'push' | 'eventReminders', enabled: boolean) => {
    await updatePreferences.mutateAsync({ notifications: { [type]: enabled } });
  };

  if (isLoading) {
    return <ListLoading />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Theme */}
      <div className="app-card">
        <SettingsSectionHead icon="palette" title={t('theme.title')} description={t('theme.description')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {themes.map((opt) => {
            const isActive = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleThemeChange(opt.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '14px 10px', borderRadius: 10, cursor: 'pointer',
                  border: isActive ? '2px solid var(--green-ink)' : '2px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                  background: isActive ? 'color-mix(in oklab, var(--green-soft) 40%, var(--paper))' : 'none',
                  transition: 'all 0.15s', position: 'relative',
                }}
              >
                {isActive && (
                  <span style={{ position: 'absolute', top: 6, right: 6 }}>
                    <Icon name="check" size={12} style={{ color: 'var(--green-ink)' }} />
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 70%, transparent)' }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Language */}
      <div className="app-card">
        <SettingsSectionHead icon="languages" title={t('language.title')} description={t('language.description')} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {languages.map((lang) => {
            const isActive = locale === lang.id;
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => handleLanguageChange(lang.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                  border: isActive ? '2px solid var(--green-ink)' : '2px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                  background: isActive ? 'color-mix(in oklab, var(--green-soft) 40%, var(--paper))' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {isActive && (
                  <Icon name="check" size={12} style={{ color: 'var(--green-ink)' }} />
                )}
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 70%, transparent)' }}>
                  {lang.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      <div className="app-card">
        <SettingsSectionHead icon="bell" title={t('notifications.title')} description={t('notifications.description')} />

        <div className="oe-setting-list">
          {/* Erinnerungen zu Veranstaltungen gehen per E-Mail: ist E-Mail
              aus, kommen sie auch nicht (API prüft beides). */}
          {(['email', 'eventReminders', 'push'] as const).map((type) => {
            const isChecked = type === 'push'
              ? (preferences?.notifications?.push ?? false)
              : (preferences?.notifications?.[type] ?? true);
            return (
              <SettingToggle
                key={type}
                flush
                label={t(`notifications.${type}`)}
                hint={t(`notifications.${type}Description`)}
                checked={isChecked}
                onChange={(value) => handleNotificationChange(type, value)}
              />
            );
          })}
        </div>
      </div>

      {/* Der Rundgang verspricht in seinem letzten Schritt, dass man ihn
          hier erneut starten kann — dieser Knopf loest das ein. */}
      <div className="app-card">
        <SettingsSectionHead
          icon="signpost"
          title={t('tour.title')}
          description={t('tour.description')}
          actions={
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={updatePreferences.isPending}
              onClick={() => updatePreferences.mutate({ onboarding: { tourVersion: 0 } })}
            >
              {t('tour.restart')}
            </button>
          }
        />
      </div>
    </div>
  );
}
