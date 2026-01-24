'use client';

import { useEffect, useState } from 'react';
import type { Node } from '@xyflow/react';
import { Settings01, Trash01, X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Toggle } from '@/components/ui/toggle/toggle';
import { cx } from '@/utils/cx';
import { getNodeDefinition } from '../config/node-definitions';
import type { NodeConfigField } from '@/types/workflow';

interface NodeConfigPanelProps {
  node: Node | null;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
}

export function NodeConfigPanel({ node, onClose, onUpdate, onDelete }: NodeConfigPanelProps) {
  const [config, setConfig] = useState<Record<string, unknown>>({});

  const definition = node ? getNodeDefinition(node.data.type as string) : null;

  useEffect(() => {
    if (node) {
      setConfig((node.data.config as Record<string, unknown>) || {});
    }
  }, [node]);

  if (!node || !definition) {
    return (
      <div className="flex h-full w-80 flex-col border-l border-secondary bg-primary">
        <div className="flex items-center justify-between border-b border-secondary p-4">
          <h3 className="text-sm font-semibold text-primary">Konfiguration</h3>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-sm text-tertiary">
            Wählen Sie einen Baustein aus, um ihn zu konfigurieren
          </p>
        </div>
      </div>
    );
  }

  const handleFieldChange = (fieldName: string, value: unknown) => {
    const newConfig = { ...config, [fieldName]: value };
    setConfig(newConfig);
    onUpdate(node.id, { ...node.data, config: newConfig });
  };

  const renderField = (field: NodeConfigField) => {
    const value = config[field.name] ?? field.defaultValue ?? '';

    switch (field.type) {
      case 'text':
        return (
          <Input
            size="sm"
            placeholder={field.placeholder}
            value={String(value)}
            onChange={(val) => handleFieldChange(field.name, val)}
          />
        );

      case 'number':
        return (
          <Input
            size="sm"
            type="number"
            placeholder={field.placeholder}
            value={String(value)}
            onChange={(val) => handleFieldChange(field.name, Number(val))}
          />
        );

      case 'textarea':
        return (
          <textarea
            className={cx(
              'w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary',
              'placeholder:text-quaternary',
              'focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20'
            )}
            rows={3}
            placeholder={field.placeholder}
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        );

      case 'select':
        return (
          <select
            className={cx(
              'w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary',
              'focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20'
            )}
            value={String(value)}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          >
            <option value="">{field.placeholder || 'Auswählen...'}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary">{value ? 'Aktiv' : 'Inaktiv'}</span>
            <Toggle
              isSelected={Boolean(value)}
              onChange={(isSelected) => handleFieldChange(field.name, isSelected)}
            />
          </div>
        );

      case 'expression':
        return (
          <div className="space-y-1">
            <textarea
              className={cx(
                'w-full rounded-lg border border-primary bg-gray-50 px-3 py-2 font-mono text-sm text-primary',
                'placeholder:text-quaternary',
                'focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20',
                'dark:bg-gray-900'
              )}
              rows={2}
              placeholder={field.placeholder}
              value={String(value)}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
            />
            <p className="text-xs text-tertiary">
              Beispiel: order.total &gt; 50 && order.source === &apos;pos&apos;
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const categoryColors = {
    trigger: 'text-green-600 dark:text-green-400',
    condition: 'text-amber-600 dark:text-amber-400',
    action: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="flex h-full w-80 flex-col border-l border-secondary bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary p-4">
        <div className="flex items-center gap-2">
          <Settings01 className="size-4 text-tertiary" />
          <h3 className="text-sm font-semibold text-primary">Konfiguration</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-tertiary hover:bg-secondary hover:text-primary"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Node Info */}
      <div className="border-b border-secondary p-4">
        <div className="flex items-center gap-2">
          <span className={cx('text-sm font-medium', categoryColors[definition.category])}>
            {definition.category === 'trigger' ? 'Auslöser' : definition.category === 'condition' ? 'Bedingung' : 'Aktion'}
          </span>
        </div>
        <h4 className="mt-1 text-lg font-semibold text-primary">{definition.label}</h4>
        <p className="mt-1 text-sm text-tertiary">{definition.description}</p>
      </div>

      {/* Configuration Fields */}
      <div className="flex-1 overflow-y-auto p-4">
        {definition.configFields.length > 0 ? (
          <div className="space-y-4">
            {definition.configFields.map((field) => (
              <div key={field.name}>
                <label className="mb-1.5 block text-sm font-medium text-secondary">
                  {field.label}
                  {field.required && <span className="text-error-primary"> *</span>}
                </label>
                {renderField(field)}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-tertiary">
            Dieser Baustein benötigt keine weitere Konfiguration.
          </p>
        )}
      </div>

      {/* Delete Button */}
      <div className="border-t border-secondary p-4">
        <Button
          color="primary-destructive"
          size="sm"
          className="w-full"
          iconLeading={Trash01}
          onClick={() => onDelete(node.id)}
        >
          Baustein löschen
        </Button>
      </div>
    </div>
  );
}
