'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  AlertTriangle,
  Check,
  Clock,
  CreditCard01,
  Edit01,
  Globe01,
  Mail01,
  MessageTextSquare01,
  Minus,
  Package,
  Play,
  Plus,
  Printer,
  RefreshCcw01,
  Send01,
  Server01,
  Settings01,
  ShoppingBag01,
  StopCircle,
  Tablet02,
  Tag01,
  Zap,
} from '@untitledui/icons';

import { cx } from '@/utils/cx';
import { getNodeDefinition } from '../config/node-definitions';

// Icon mapping - using available icons from @untitledui/icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  // Order & Shopping
  ShoppingCart01: ShoppingBag01,
  ShoppingBag01,
  Package,

  // Status & Checks
  CheckCircle: Check,
  XCircle: AlertTriangle,
  CheckSquare: Check,
  Check,
  AlertTriangle,
  AlertCircle: AlertTriangle,
  AlertOctagon: AlertTriangle,

  // Payment & Money
  CreditCard01,
  DollarSign: CreditCard01,

  // Time & Calendar
  Calendar: Clock,
  CalendarCheck01: Check,
  Clock,
  Hourglass01: Clock,

  // Actions & Controls
  Hand: Play,
  Play,
  RefreshCw01: Settings01,
  RefreshCcw01,
  Repeat: RefreshCcw01,
  StopCircle,

  // Flow Control
  GitBranch: Settings01,
  GitMerge: Settings01,
  Filter: Tag01,
  FolderCheck: Tag01,
  Tag01,

  // Printing
  Receipt: Printer,
  ChefHat: Printer,
  Ticket01: Printer,
  Printer,

  // Devices & Hardware
  Smartphone: Tablet02,
  Monitor: Tablet02,
  Tablet02,
  Server01,
  Radio: Zap,
  Power01: Zap,
  Send01,

  // Stock & Inventory
  Plus,
  Minus,

  // Communication
  Mail01,
  MessageSquare: MessageTextSquare01,
  MessageTextSquare01,
  Globe01,
  Webhook: Globe01,

  // Editing & Files
  Edit03: Edit01,
  Edit01,
  FileText: Edit01,

  // Settings & Config
  Settings01,
  Zap,
};

interface WorkflowNodeData {
  label: string;
  type: string;
  config?: Record<string, unknown>;
}

interface WorkflowNodeProps {
  data: WorkflowNodeData;
  selected?: boolean;
}

// Base node component
function BaseNode({
  data,
  selected,
  category,
  color,
  showInputHandle = true,
  showOutputHandle = true,
  outputCount = 1,
}: {
  data: WorkflowNodeData;
  selected: boolean;
  category: 'trigger' | 'condition' | 'action';
  color: string;
  showInputHandle?: boolean;
  showOutputHandle?: boolean;
  outputCount?: number;
}) {
  const definition = getNodeDefinition(data.type);
  const IconComponent = definition?.icon ? iconMap[definition.icon] || Zap : Zap;

  const categoryColors = {
    trigger: 'border-green-500 bg-green-50 dark:bg-green-950',
    condition: 'border-amber-500 bg-amber-50 dark:bg-amber-950',
    action: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
  };

  const categoryIconColors = {
    trigger: 'text-green-600 dark:text-green-400',
    condition: 'text-amber-600 dark:text-amber-400',
    action: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <div
      className={cx(
        'min-w-[180px] rounded-lg border-2 shadow-md transition-shadow',
        categoryColors[category],
        selected && 'ring-2 ring-brand-500 ring-offset-2'
      )}
    >
      {/* Input Handle */}
      {showInputHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="!size-3 !border-2 !border-white !bg-gray-400 dark:!border-gray-800"
        />
      )}

      {/* Node Content */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div
            className={cx(
              'flex size-8 items-center justify-center rounded-md',
              category === 'trigger' && 'bg-green-100 dark:bg-green-900',
              category === 'condition' && 'bg-amber-100 dark:bg-amber-900',
              category === 'action' && 'bg-blue-100 dark:bg-blue-900'
            )}
          >
            <IconComponent className={cx('size-4', categoryIconColors[category])} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-primary">
              {definition?.label || data.label}
            </p>
            <p className="truncate text-xs text-tertiary">
              {category === 'trigger' ? 'Auslöser' : category === 'condition' ? 'Bedingung' : 'Aktion'}
            </p>
          </div>
        </div>

        {/* Show config preview if available */}
        {data.config && Object.keys(data.config).length > 0 && (
          <div className="mt-2 rounded bg-white/50 p-2 dark:bg-black/20">
            <p className="text-xs text-tertiary">
              {Object.entries(data.config)
                .slice(0, 2)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Output Handles */}
      {showOutputHandle && outputCount === 1 && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!size-3 !border-2 !border-white !bg-gray-400 dark:!border-gray-800"
        />
      )}

      {/* Multiple output handles for conditions */}
      {showOutputHandle && outputCount === 2 && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!-left-[10px] !size-3 !border-2 !border-white !bg-green-500 dark:!border-gray-800"
            style={{ left: '25%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!size-3 !border-2 !border-white !bg-red-500 dark:!border-gray-800"
            style={{ left: '75%' }}
          />
          <div className="flex justify-between px-4 pb-1 text-[10px] text-tertiary">
            <span>Ja</span>
            <span>Nein</span>
          </div>
        </>
      )}
    </div>
  );
}

// Trigger Node
export const TriggerNode = memo(function TriggerNode({ data, selected }: WorkflowNodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected ?? false}
      category="trigger"
      color="#10B981"
      showInputHandle={false}
      showOutputHandle={true}
    />
  );
});

// Condition Node
export const ConditionNode = memo(function ConditionNode({ data, selected }: WorkflowNodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected ?? false}
      category="condition"
      color="#F59E0B"
      showInputHandle={true}
      showOutputHandle={true}
      outputCount={2}
    />
  );
});

// Action Node
export const ActionNode = memo(function ActionNode({ data, selected }: WorkflowNodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected ?? false}
      category="action"
      color="#3B82F6"
      showInputHandle={true}
      showOutputHandle={true}
    />
  );
});

// Node types for ReactFlow
export const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
};
