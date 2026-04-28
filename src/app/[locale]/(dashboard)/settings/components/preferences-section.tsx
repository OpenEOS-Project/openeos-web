'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import { usePreferences, useUpdatePreferences } from '@/hooks/use-user-settings';

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
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  const handleNotificationChange = async (type: 'email' | 'push', enabled: boolean) => {
    await updatePreferences.mutateAsync({ notifications: { [type]: enabled } });
  };

  if (isLoading) {
    return (
      <div className="app-card" style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Theme */}
      <div className="app-card">
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t('theme.title')}</h3>
        </div>
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green-ink)" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
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
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t('language.title')}</h3>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green-ink)" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
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
      <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t('notifications.title')}</h3>
        </div>

        {(['email', 'push'] as const).map((type, i) => {
          const isChecked = type === 'email'
            ? (preferences?.notifications?.email ?? true)
            : (preferences?.notifications?.push ?? false);
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i === 0 ? '1px solid color-mix(in oklab, var(--ink) 5%, transparent)' : 'none' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t(`notifications.${type}`)}</div>
                <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t(`notifications.${type}Description`)}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isChecked}
                onClick={() => handleNotificationChange(type, !isChecked)}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: isChecked ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 18%, transparent)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: isChecked ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
