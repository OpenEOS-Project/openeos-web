'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import {
  useCreatePrintTemplate,
  useUpdatePrintTemplate,
} from '@/hooks/use-print-templates';
import type {
  TemplateElement,
  PrintTemplateDesign,
  PaletteItem,
  PrintTemplate,
  PrintTemplateType,
} from '@/types/print-template';
import { generateTemplate } from '../templates/[id]/utils/template-generator';
import { getDefaultElements } from '../templates/[id]/utils/default-templates';
import { ElementPalette } from '../templates/[id]/components/element-palette';
import { ReceiptCanvas } from '../templates/[id]/components/receipt-canvas';
import { PropertyPanel } from '../templates/[id]/components/property-panel';

interface InlineTemplateDesignerProps {
  organizationId: string;
  templateType: PrintTemplateType;
  existingTemplate: PrintTemplate | null;
  defaultName: string;
}

function createElementFromPalette(item: PaletteItem): TemplateElement {
  const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const base: TemplateElement = { id, type: item.type };

  if (item.type === 'field' && item.field) {
    base.field = item.field;
    switch (item.field) {
      case 'organization_name': base.align = 'center'; base.bold = true; base.big = true; break;
      case 'organization_address': base.align = 'center'; break;
      case 'organization_phone': base.align = 'center'; base.label = 'Tel: '; base.condition = 'organization.phone'; break;
      case 'event_name': base.align = 'center'; base.condition = 'event_name'; break;
      case 'table_number': base.label = 'Tisch: '; base.condition = 'table_number'; break;
      case 'customer_name': base.label = 'Kunde: '; base.condition = 'customer_name'; break;
      case 'order_number': base.label = '#'; base.bold = true; break;
      case 'daily_number': base.label = '#'; base.big = true; break;
      case 'total': base.bold = true; break;
      case 'items_list': base.showNotes = true; base.showOptions = true; base.showPrice = true; break;
    }
  } else if (item.type === 'separator') {
    base.char = '=';
  } else if (item.type === 'spacer') {
    base.lines = 1;
  } else if (item.type === 'feed') {
    base.lines = 3;
  }

  return base;
}

export function InlineTemplateDesigner({
  organizationId,
  templateType,
  existingTemplate,
  defaultName,
}: InlineTemplateDesignerProps) {
  const t = useTranslations('printTemplates.designer');
  const createTemplate = useCreatePrintTemplate(organizationId);
  const updateTemplate = useUpdatePrintTemplate(organizationId);

  const [templateId, setTemplateId] = useState<string | null>(existingTemplate?.id || null);

  const [design, setDesign] = useState<PrintTemplateDesign>(() => {
    if (existingTemplate?.template?.elements && existingTemplate.template.elements.length > 0) {
      return existingTemplate.template;
    }
    return { paperWidth: 80, elements: getDefaultElements(templateType) };
  });

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const selectedElement = design.elements.find((el) => el.id === selectedElementId) || null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (existingTemplate?.id && !templateId) setTemplateId(existingTemplate.id);
  }, [existingTemplate?.id, templateId]);

  useEffect(() => {
    if (saveState === 'saved') {
      const timeout = setTimeout(() => setSaveState('idle'), 2000);
      return () => clearTimeout(timeout);
    }
  }, [saveState]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const data = active.data.current;
    if (data?.type === 'palette-item') {
      const paletteItem = data.item as PaletteItem;
      const newElement = createElementFromPalette(paletteItem);
      setDesign((prev) => {
        const overIndex = prev.elements.findIndex((el) => el.id === over.id);
        const elements = [...prev.elements];
        if (overIndex >= 0) elements.splice(overIndex + 1, 0, newElement);
        else elements.push(newElement);
        return { ...prev, elements };
      });
      setSelectedElementId(newElement.id);
      return;
    }

    if (active.id !== over.id) {
      setDesign((prev) => {
        const oldIndex = prev.elements.findIndex((el) => el.id === active.id);
        const newIndex = prev.elements.findIndex((el) => el.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return { ...prev, elements: arrayMove(prev.elements, oldIndex, newIndex) };
      });
    }
  }, []);

  const handleUpdateElement = useCallback((id: string, updates: Partial<TemplateElement>) => {
    setDesign((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => el.id === id ? { ...el, ...updates } : el),
    }));
  }, []);

  const handleRemoveElement = useCallback((id: string) => {
    setDesign((prev) => ({ ...prev, elements: prev.elements.filter((el) => el.id !== id) }));
    if (selectedElementId === id) setSelectedElementId(null);
  }, [selectedElementId]);

  const handlePaperWidthChange = useCallback((width: 80 | 58) => {
    setDesign((prev) => ({ ...prev, paperWidth: width }));
  }, []);

  const handleSave = async () => {
    setSaveState('saving');
    try {
      const generatedTemplate = generateTemplate(design);
      const updatedDesign = { ...design, generatedTemplate };

      if (templateId) {
        await updateTemplate.mutateAsync({ templateId, data: { template: updatedDesign } });
      } else {
        const response = await createTemplate.mutateAsync({
          name: defaultName,
          type: templateType,
          template: updatedDesign,
          isDefault: true,
        });
        const created = (response as { data: PrintTemplate }).data;
        if (created?.id) setTemplateId(created.id);
      }

      setDesign(updatedDesign);
      setSaveState('saved');
    } catch {
      setSaveState('idle');
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
          background: 'var(--paper)', padding: '8px 16px', borderRadius: '10px 10px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
              {t('paperWidth')}:
            </span>
            <div style={{
              display: 'flex', borderRadius: 8,
              border: '1px solid color-mix(in oklab, var(--ink) 12%, transparent)', overflow: 'hidden',
            }}>
              {([80, 58] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => handlePaperWidthChange(w)}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: design.paperWidth === w ? 'color-mix(in oklab, var(--green-ink) 10%, transparent)' : 'transparent',
                    color: design.paperWidth === w ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 55%, transparent)',
                    border: 'none',
                  }}
                >
                  {w}mm
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saveState === 'saving'}
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            {saveState === 'saving' ? t('saving') : saveState === 'saved' ? `✓ ${t('saved')}` : t('save')}
          </button>
        </div>

        {/* 3-column layout */}
        <div style={{
          display: 'flex', flex: 1, overflow: 'hidden',
          border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
          borderTop: 'none', borderRadius: '0 0 10px 10px',
        }}>
          {/* Left: Palette */}
          <div style={{
            width: 240, flexShrink: 0,
            borderRight: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
            background: 'var(--paper)',
          }}>
            <ElementPalette />
          </div>

          {/* Center: Canvas */}
          <div style={{ flex: 1, background: 'color-mix(in oklab, var(--ink) 4%, transparent)' }}>
            <ReceiptCanvas
              design={design}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onRemoveElement={handleRemoveElement}
            />
          </div>

          {/* Right: Properties */}
          <div style={{
            flexShrink: 0, overflow: 'hidden',
            borderLeft: selectedElement ? '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' : 'none',
            background: 'var(--paper)',
            transition: 'width 200ms ease-in-out',
            width: selectedElement ? '320px' : '0px',
          }}>
            <div style={{ width: 320 }}>
              {selectedElement && (
                <PropertyPanel
                  element={selectedElement}
                  onUpdate={handleUpdateElement}
                  onRemove={handleRemoveElement}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div style={{
            borderRadius: 8, border: '1px solid var(--green-ink)',
            background: 'color-mix(in oklab, var(--green-ink) 10%, transparent)',
            padding: '6px 12px', fontSize: 13, fontWeight: 500,
            color: 'var(--green-ink)', boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          }}>
            Verschieben...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
