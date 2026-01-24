export interface WorkflowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface WorkflowTriggerConfig {
  event?: string;
  conditions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Workflow {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: WorkflowTriggerConfig;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowData {
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig?: WorkflowTriggerConfig;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  isActive?: boolean;
}

export interface UpdateWorkflowData {
  name?: string;
  description?: string | null;
  triggerType?: string;
  triggerConfig?: WorkflowTriggerConfig;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  isActive?: boolean;
}

// Node definition types for the builder
export type NodeCategory = 'trigger' | 'condition' | 'action';

export interface NodeDefinition {
  type: string;
  category: NodeCategory;
  subcategory?: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  inputs: number; // Number of input handles (0 for triggers)
  outputs: number; // Number of output handles
  configFields: NodeConfigField[];
}

export interface NodeConfigField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'boolean' | 'textarea' | 'expression';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
}

// Workflow run types
export type WorkflowRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowRunLogEntry {
  nodeId: string;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
  output?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  triggerEvent: string;
  triggerData: Record<string, unknown>;
  status: WorkflowRunStatus;
  startedAt: string;
  completedAt: string | null;
  executionLog: WorkflowRunLogEntry[];
  error: string | null;
}
