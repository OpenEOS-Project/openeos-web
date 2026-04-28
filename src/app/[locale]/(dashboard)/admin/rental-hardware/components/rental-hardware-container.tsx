'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HardDrive, File06 } from '@untitledui/icons';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs/tabs';
import { HardwareList } from './hardware-list';
import { AssignmentsList } from './assignments-list';

export function RentalHardwareContainer() {
  const t = useTranslations('admin.rental');
  const [activeTab, setActiveTab] = useState<string>('hardware');

  return (
    <Tabs
      selectedKey={activeTab}
      onSelectionChange={(key) => setActiveTab(key as string)}
    >
      <TabList type="underline" size="md">
        <Tab id="hardware" className="flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          {t('hardware.title')}
        </Tab>
        <Tab id="assignments" className="flex items-center gap-2">
          <File06 className="h-4 w-4" />
          {t('assignments.title')}
        </Tab>
      </TabList>

      <TabPanel id="hardware" className="pt-6">
        <HardwareList />
      </TabPanel>

      <TabPanel id="assignments" className="pt-6">
        <AssignmentsList />
      </TabPanel>
    </Tabs>
  );
}
