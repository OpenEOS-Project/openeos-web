'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { usePrintTemplates } from '@/hooks/use-print-templates';
import type { PrintTemplate, PrintTemplateType } from '@/types/print-template';
import { InlineTemplateDesigner } from './inline-template-designer';

const TEMPLATE_TYPES: { id: PrintTemplateType; defaultName: string }[] = [
  { id: 'receipt', defaultName: 'Kassenbon' },
  { id: 'kitchen_ticket', defaultName: 'Küchenbon' },
  { id: 'order_ticket', defaultName: 'Bestellbon' },
];

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid var(--green-ink)', borderTopColor: 'transparent',
        animation: 'spin 0.75s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function TemplatesTab() {
  const t = useTranslations('printTemplates');
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId ?? '';
  const [activeType, setActiveType] = useState<string>('receipt');

  const { data: templates, isLoading } = usePrintTemplates(organizationId);

  const templatesByType = useMemo(() => {
    const map: Partial<Record<PrintTemplateType, PrintTemplate>> = {};
    if (templates) {
      for (const tmpl of templates) {
        if (!map[tmpl.type]) map[tmpl.type] = tmpl;
      }
    }
    return map;
  }, [templates]);

  if (isLoading) return <Spinner />;

  return (
    <div>
      {/* Type tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {TEMPLATE_TYPES.map(({ id }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveType(id)}
            style={{
              padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              borderRadius: 8,
              border: `1px solid ${activeType === id ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 12%, transparent)'}`,
              background: activeType === id ? 'color-mix(in oklab, var(--green-ink) 10%, transparent)' : 'transparent',
              color: activeType === id ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 55%, transparent)',
            }}
          >
            {t(`types.${id}`)}
          </button>
        ))}
      </div>

      {TEMPLATE_TYPES.map(({ id, defaultName }) => (
        activeType === id && (
          <InlineTemplateDesigner
            key={id}
            organizationId={organizationId}
            templateType={id}
            existingTemplate={templatesByType[id] || null}
            defaultName={defaultName}
          />
        )
      ))}
    </div>
  );
}
