'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Printer, File06 } from '@untitledui/icons';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs/tabs';
import { PrintersList } from './printers-list';
import { TemplatesTab } from './templates-tab';

export function PrintersContainer() {
  const t = useTranslations('printers');
  const [activeTab, setActiveTab] = useState<string>('printers');

  return (
    <Tabs
      selectedKey={activeTab}
      onSelectionChange={(key) => setActiveTab(key as string)}
    >
      <TabList type="underline" size="md">
        <Tab id="printers" className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          {t('tabs.printers')}
        </Tab>
        <Tab id="templates" className="flex items-center gap-2">
          <File06 className="h-4 w-4" />
          {t('tabs.templates')}
        </Tab>
      </TabList>

      <TabPanel id="printers" className="pt-6">
        <PrintersList />
      </TabPanel>

      <TabPanel id="templates" className="pt-6">
        <TemplatesTab />
      </TabPanel>
    </Tabs>
  );
}
