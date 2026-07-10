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
import { PlatformNotificationsSection } from './platform-notifications-section';
import { useAuthStore } from '@/stores/auth-store';

interface SettingsTab {
  id: string;
  label: string;
  children: React.ReactNode;
}

function TabBar({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeId === tab.id}
          className={`tab-bar__tab${activeId === tab.id ? ' tab-bar__tab--active' : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsContainer() {
  const t = useTranslations('settings');
  const { currentOrganization, user } = useAuthStore();
  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const [activeMain, setActiveMain] = useState<'personal' | 'organization' | 'platform'>('personal');
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
      {/* Main tabs: Personal / Organization (or Personal / Platform for super-admins) */}
      <TabBar
        tabs={
          isSuperAdmin
            ? [
                { id: 'personal', label: t('tabs.personal') },
                { id: 'platform', label: t('tabs.platform') },
              ]
            : [
                { id: 'personal', label: t('tabs.personal') },
                { id: 'organization', label: t('tabs.organization') },
              ]
        }
        activeId={activeMain}
        onSelect={(id) => setActiveMain(id as 'personal' | 'organization' | 'platform')}
      />

      {/* Personal settings */}
      {activeMain === 'personal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Personal sub-tabs */}
          <TabBar tabs={personalTabs} activeId={activePersonal} onSelect={setActivePersonal} />
          {personalTabs.find((tab) => tab.id === activePersonal)?.children}
        </div>
      )}

      {/* Organization settings */}
      {activeMain === 'organization' && !isSuperAdmin && (
        <>
          {currentOrganization ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <TabBar tabs={organizationTabs} activeId={activeOrg} onSelect={setActiveOrg} />
              {organizationTabs.find((tab) => tab.id === activeOrg)?.children}
            </div>
          ) : (
            <div className="app-card" style={{ textAlign: 'center', padding: 24 }}>
              <p style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)', fontSize: 14 }}>
                {t('noOrganization')}
              </p>
            </div>
          )}
        </>
      )}

      {/* Platform settings (super-admin only) */}
      {activeMain === 'platform' && isSuperAdmin && <PlatformNotificationsSection />}
    </div>
  );
}
