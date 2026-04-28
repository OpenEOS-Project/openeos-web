'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { DotsVertical, X } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import type { TemplateElement, PrintTemplateDesign } from '@/types/print-template';
import { renderPreview } from '../utils/preview-renderer';

interface ReceiptCanvasProps {
  design: PrintTemplateDesign;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onRemoveElement: (id: string) => void;
}

function SortableCanvasElement({
  element,
  previewLines,
  isSelected,
  onSelect,
  onRemove,
  cols,
}: {
  element: TemplateElement;
  previewLines: { text: string; bold?: boolean; big?: boolean; align?: string; isSpecial?: boolean; isQrCode?: boolean }[];
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  cols: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        'group relative',
        isDragging && 'z-10 opacity-70',
      )}
    >
      {/* Selection border + controls */}
      <div
        className={cx(
          'relative rounded border transition-colors cursor-pointer',
          isSelected
            ? 'border-brand-solid bg-brand-secondary/30'
            : 'border-transparent hover:border-secondary',
        )}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {/* Drag handle + remove button */}
        <div className={cx(
          'absolute -left-7 top-0 flex flex-col items-center gap-0.5 opacity-0 transition-opacity',
          'group-hover:opacity-100',
          isSelected && 'opacity-100',
        )}>
          <button
            type="button"
            className="cursor-grab rounded p-0.5 text-quaternary hover:text-tertiary active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <DotsVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="rounded p-0.5 text-quaternary hover:text-error-primary"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Preview lines */}
        <div className="px-1">
          {previewLines.map((line, i) => {
            if (line.isQrCode) {
              return (
                <div key={i} className="flex justify-center py-2">
                  <QRCodeSVG value="https://openeos.de" size={64} />
                </div>
              );
            }

            if (line.isSpecial) {
              return (
                <div
                  key={i}
                  className="text-center text-[10px] italic text-quaternary"
                  style={{ fontFamily: 'monospace' }}
                >
                  {line.text}
                </div>
              );
            }

            const fontSize = line.big ? '13px' : '11px';
            let textAlign: 'left' | 'center' | 'right' = 'left';
            if (line.align === 'center') textAlign = 'center';
            if (line.align === 'right') textAlign = 'right';

            return (
              <div
                key={i}
                className={cx(
                  'whitespace-pre leading-tight',
                  line.bold && 'font-bold',
                )}
                style={{
                  fontFamily: 'monospace',
                  fontSize,
                  textAlign,
                  maxWidth: `${cols}ch`,
                }}
              >
                {line.text || '\u00A0'}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ReceiptCanvas({
  design,
  selectedElementId,
  onSelectElement,
  onRemoveElement,
}: ReceiptCanvasProps) {
  const t = useTranslations('printTemplates.designer');
  const cols = design.paperWidth === 80 ? 42 : 32;

  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-drop-zone',
  });

  // Group preview lines by element
  const allPreviewLines = renderPreview(design);
  const elementPreviewMap = new Map<string, typeof allPreviewLines>();
  for (const line of allPreviewLines) {
    const existing = elementPreviewMap.get(line.elementId) || [];
    existing.push(line);
    elementPreviewMap.set(line.elementId, existing);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-secondary px-4 py-3">
        <h3 className="text-sm font-semibold text-primary">{t('canvas')}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4" onClick={() => onSelectElement(null)}>
        <div className="mx-auto flex justify-center">
          {/* Receipt paper */}
          <div
            ref={setNodeRef}
            className={cx(
              'relative rounded-lg border bg-white p-4 pl-8 shadow-sm transition-colors dark:bg-gray-50',
              isOver ? 'border-brand-solid' : 'border-gray-200',
            )}
            style={{
              width: `calc(${cols}ch + 4rem)`,
              minHeight: '400px',
              fontFamily: 'monospace',
            }}
            onClick={() => onSelectElement(null)}
          >
            {design.elements.length === 0 ? (
              <div className="flex h-full min-h-[300px] items-center justify-center">
                <p className="text-sm text-gray-400 italic">{t('dragHint')}</p>
              </div>
            ) : (
              <SortableContext
                items={design.elements.map((el) => el.id)}
                strategy={verticalListSortingStrategy}
              >
                {design.elements.map((element) => (
                  <SortableCanvasElement
                    key={element.id}
                    element={element}
                    previewLines={elementPreviewMap.get(element.id) || []}
                    isSelected={selectedElementId === element.id}
                    onSelect={() => onSelectElement(element.id)}
                    onRemove={() => onRemoveElement(element.id)}
                    cols={cols}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
