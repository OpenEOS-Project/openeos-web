'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ProfileSection } from './profile-section';
import { AccountSection } from './account-section';
import { SecuritySection } from './security-section';
import { PreferencesSection } from './preferences-section';
import { OrganizationGeneralSection } from './organization-general-section';
import { OrganizationContactSection } from './organization-contact-section';
import { OrganizationBillingSection } from './organization-billing-section';
import { OrganizationPosSection } from './organization-pos-section';
import { OrganizationSumupSection } from './organization-sumup-section';
import { useAuthStore } from '@/stores/auth-store';

interface SettingsTab {
  id: string;
  label: string;
  children: React.ReactNode;
}

const tabBarStyle = {
  display: 'flex',
  gap: 0,
  borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
  marginBottom: 20,
  overflowX: 'auto' as const,
};

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: active ? 600 : 500,
  color: active ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 55%, transparent)',
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--green-ink)' : '2px solid transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  marginBottom: -1,
  transition: 'all 0.15s',
});

export function SettingsContainer() {
  const t = useTranslations('settings');
  const { currentOrganization, user } = useAuthStore();
  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const [activeMain, setActiveMain] = useState<'personal' | 'organization'>('personal');
  const [activePersonal, setActivePersonal] = useState('profile');
  const [activeOrg, setActiveOrg] = useState('org-general');

  const personalTabs: SettingsTab[] = [
    { id: 'profile', label: t('profile.title'), children: <ProfileSection /> },
    { id: 'account', label: t('account.title'), children: <AccountSection /> },
    { id: 'security', label: t('security.title'), children: <SecuritySection /> },
    { id: 'preferences', label: t('preferences.title'), children: <PreferencesSection /> },
  ];

  const organizationTabs: SettingsTab[] = [
    { id: 'org-general', label: t('organizationGeneral.title'), children: <OrganizationGeneralSection /> },
    { id: 'org-contact', label: t('organizationContact.title'), children: <OrganizationContactSection /> },
    { id: 'org-billing', label: t('organizationBilling.title'), children: <OrganizationBillingSection /> },
    { id: 'org-pos', label: t('organizationPos.title'), children: <OrganizationPosSection /> },
    { id: 'org-sumup', label: t('organizationSumup.title'), children: <OrganizationSumupSection /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Main tabs: Personal / Organization */}
      {!isSuperAdmin && (
        <div style={tabBarStyle}>
          {(['personal', 'organization'] as const).map((tab) => (
            <button
              key={tab}
              style={tabBtnStyle(activeMain === tab)}
              onClick={() => setActiveMain(tab)}
            >
              {tab === 'personal' ? t('tabs.personal') : t('tabs.organization')}
            </button>
          ))}
        </div>
      )}

      {/* Personal settings */}
      {(activeMain === 'personal' || isSuperAdmin) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Personal sub-tabs */}
          <div style={tabBarStyle}>
            {personalTabs.map((tab) => (
              <button
                key={tab.id}
                style={tabBtnStyle(activePersonal === tab.id)}
                onClick={() => setActivePersonal(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {personalTabs.find((t) => t.id === activePersonal)?.children}
        </div>
      )}

      {/* Organization settings */}
      {activeMain === 'organization' && !isSuperAdmin && (
        <>
          {currentOrganization ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={tabBarStyle}>
                {organizationTabs.map((tab) => (
                  <button
                    key={tab.id}
                    style={tabBtnStyle(activeOrg === tab.id)}
                    onClick={() => setActiveOrg(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {organizationTabs.find((t) => t.id === activeOrg)?.children}
            </div>
          ) : (
            <div className="app-card" style={{ textAlign: 'center', padding: 24 }}>
              <p style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)', fontSize: 14 }}>
                Bitte wählen Sie zuerst eine Organisation aus.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
