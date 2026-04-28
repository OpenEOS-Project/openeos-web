'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs/tabs';
import { useAuthStore } from '@/stores/auth-store';
import { usePrintTemplates } from '@/hooks/use-print-templates';
import type { PrintTemplate, PrintTemplateType } from '@/types/print-template';
import { InlineTemplateDesigner } from './inline-template-designer';

const TEMPLATE_TYPES: { id: PrintTemplateType; defaultName: string }[] = [
  { id: 'receipt', defaultName: 'Kassenbon' },
  { id: 'kitchen_ticket', defaultName: 'Küchenbon' },
  { id: 'order_ticket', defaultName: 'Bestellbon' },
];

export function TemplatesTab() {
  const t = useTranslations('printTemplates');
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId ?? '';
  const [activeType, setActiveType] = useState<string>('receipt');

  const { data: templates, isLoading } = usePrintTemplates(organizationId);

  // Map templates by type - pick first of each type
  const templatesByType = useMemo(() => {
    const map: Partial<Record<PrintTemplateType, PrintTemplate>> = {};
    if (templates) {
      for (const tmpl of templates) {
        if (!map[tmpl.type]) {
          map[tmpl.type] = tmpl;
        }
      }
    }
    return map;
  }, [templates]);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Tabs
      selectedKey={activeType}
      onSelectionChange={(key) => setActiveType(key as string)}
    >
      <TabList type="button-gray" size="sm">
        {TEMPLATE_TYPES.map(({ id }) => (
          <Tab key={id} id={id}>
            {t(`types.${id}`)}
          </Tab>
        ))}
      </TabList>

      {TEMPLATE_TYPES.map(({ id, defaultName }) => (
        <TabPanel key={id} id={id} className="pt-4">
          <InlineTemplateDesigner
            organizationId={organizationId}
            templateType={id}
            existingTemplate={templatesByType[id] || null}
            defaultName={defaultName}
          />
        </TabPanel>
      ))}
    </Tabs>
  );
}
