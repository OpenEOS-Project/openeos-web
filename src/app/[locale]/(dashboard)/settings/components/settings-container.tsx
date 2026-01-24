'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs/tabs';
import { ProfileSection } from './profile-section';
import { AccountSection } from './account-section';
import { SecuritySection } from './security-section';
import { PreferencesSection } from './preferences-section';
import { OrganizationGeneralSection } from './organization-general-section';
import { OrganizationContactSection } from './organization-contact-section';
import { OrganizationBillingSection } from './organization-billing-section';
import { OrganizationPosSection } from './organization-pos-section';
import { useAuthStore } from '@/stores/auth-store';

interface SettingsTab {
  id: string;
  label: string;
  children: React.ReactNode;
}

export function SettingsContainer() {
  const t = useTranslations('settings');
  const { currentOrganization, user } = useAuthStore();
  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const [activeTab, setActiveTab] = useState<string>('personal');

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
  ];

  // Super-admins don't see organization tab
  const mainTabs = isSuperAdmin
    ? [{ id: 'personal', label: t('tabs.personal') }]
    : [
        { id: 'personal', label: t('tabs.personal') },
        { id: 'organization', label: t('tabs.organization') },
      ];

  const currentTabs = activeTab === 'personal' ? personalTabs : organizationTabs;

  return (
    <div className="space-y-6">
      {/* Main Tabs: Personal / Organization */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
      >
        <TabList items={mainTabs} type="underline" size="md">
          {(tab) => <Tab key={tab.id} id={tab.id}>{tab.label}</Tab>}
        </TabList>
      </Tabs>

      {/* Nested Content */}
      <div className="mt-6">
        {activeTab === 'personal' && (
          <Tabs defaultSelectedKey="profile">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sidebar Navigation */}
              <div className="w-full lg:w-48 shrink-0">
                <TabList
                  items={personalTabs}
                  type="line"
                  size="sm"
                  orientation="vertical"
                  className="w-full"
                >
                  {(tab) => <Tab key={tab.id} id={tab.id}>{tab.label}</Tab>}
                </TabList>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {personalTabs.map((tab) => (
                  <TabPanel key={tab.id} id={tab.id}>
                    {tab.children}
                  </TabPanel>
                ))}
              </div>
            </div>
          </Tabs>
        )}

        {activeTab === 'organization' && currentOrganization && (
          <Tabs defaultSelectedKey="org-general">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sidebar Navigation */}
              <div className="w-full lg:w-48 shrink-0">
                <TabList
                  items={organizationTabs}
                  type="line"
                  size="sm"
                  orientation="vertical"
                  className="w-full"
                >
                  {(tab) => <Tab key={tab.id} id={tab.id}>{tab.label}</Tab>}
                </TabList>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {organizationTabs.map((tab) => (
                  <TabPanel key={tab.id} id={tab.id}>
                    {tab.children}
                  </TabPanel>
                ))}
              </div>
            </div>
          </Tabs>
        )}

        {activeTab === 'organization' && !currentOrganization && (
          <div className="rounded-xl border border-secondary bg-primary p-6 text-center">
            <p className="text-tertiary">
              Bitte wählen Sie zuerst eine Organisation aus.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
