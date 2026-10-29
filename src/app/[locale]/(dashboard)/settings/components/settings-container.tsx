'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ProfileSection } from './profile-section';
import { AccountSection } from './account-section';
import { SecuritySection } from './security-section';
import { PreferencesSection } from './preferences-section';
import { OrganizationGeneralSection } from './organization-general-section';
import { OrganizationContactSection } from './organization-contact-section';
import { OrganizationLegalSection } from './organization-legal-section';
import { OrganizationPaymentsSection } from './organization-payments-section';
import { OrganizationAssistantSection } from './organization-assistant-section';
import { PlatformNotificationsSection } from './platform-notifications-section';
import { AboutSection } from './about-section';
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
  /* ?tab=org-legal (und die anderen Reiter-IDs) oeffnet direkt den Reiter —
     die Warnungen an Shop und Schichtplan verlinken so auf die rechtlichen
     Angaben. */
  const requestedTab = useSearchParams().get('tab');
  const orgTabIds = ['org-general', 'org-contact', 'org-payments', 'org-assistant', 'org-legal'];
  const [activeMain, setActiveMain] = useState<'personal' | 'organization' | 'platform'>(
    requestedTab && orgTabIds.includes(requestedTab) ? 'organization' : 'personal',
  );
  const [activePersonal, setActivePersonal] = useState('profile');
  const [activeOrg, setActiveOrg] = useState(
    requestedTab && orgTabIds.includes(requestedTab) ? requestedTab : 'org-general',
  );

  const personalTabs: SettingsTab[] = [
    { id: 'profile', label: t('profile.title'), children: <ProfileSection /> },
    { id: 'account', label: t('account.title'), children: <AccountSection /> },
    { id: 'security', label: t('security.title'), children: <SecuritySection /> },
    { id: 'preferences', label: t('preferences.title'), children: <PreferencesSection /> },
    { id: 'about', label: t('about.title'), children: <AboutSection /> },
  ];

  const organizationTabs: SettingsTab[] = [
    { id: 'org-general', label: t('organizationGeneral.title'), children: <OrganizationGeneralSection /> },
    { id: 'org-contact', label: t('organizationContact.title'), children: <OrganizationContactSection /> },
    { id: 'org-payments', label: t('organizationPayments.tab'), children: <OrganizationPaymentsSection /> },
    { id: 'org-assistant', label: t('organizationAssistant.tab'), children: <OrganizationAssistantSection /> },
    { id: 'org-legal', label: t('organizationLegal.tab'), children: <OrganizationLegalSection /> },
  ];

  /* Super-Admins bekamen frueher statt "Organisation" nur "Plattform". Auf
     einer eigenstaendigen Installation ist der Super-Admin aus der
     Ersteinrichtung aber zugleich der einzige Admin des Vereins — Name,
     Logo und Kontakt liessen sich dort von niemandem mehr aendern. Gehoert
     er einer Organisation an, sieht er deshalb beide Reiter. */
  const showOrganizationTab = !isSuperAdmin || !!currentOrganization;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Main tabs: Personal / Organization / Platform (super-admins only) */}
      <TabBar
        tabs={[
          { id: 'personal', label: t('tabs.personal') },
          ...(showOrganizationTab ? [{ id: 'organization', label: t('tabs.organization') }] : []),
          ...(isSuperAdmin ? [{ id: 'platform', label: t('tabs.platform') }] : []),
        ]}
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
      {activeMain === 'organization' && showOrganizationTab && (
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
