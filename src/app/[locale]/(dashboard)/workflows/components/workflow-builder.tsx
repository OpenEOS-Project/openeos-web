'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  ReactFlowProvider,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Check, Play } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import type { Workflow, WorkflowEdge, WorkflowNode } from '@/types/workflow';
import { getNodeDefinition } from '../config/node-definitions';
import { NodeConfigPanel } from './node-config-panel';
import { NodeSidebar } from './node-sidebar';
import { nodeTypes } from './workflow-nodes';

interface WorkflowBuilderProps {
  workflow: Workflow | null;
  organizationId: string;
  onSave: (data: { name: string; description: string; nodes: WorkflowNode[]; edges: WorkflowEdge[]; triggerType: string }) => void;
  onBack: () => void;
  isSaving?: boolean;
}

// Convert workflow nodes to ReactFlow nodes
function toReactFlowNodes(nodes: WorkflowNode[]): Node[] {
  if (!nodes || !Array.isArray(nodes)) return [];

  return nodes
    .filter((node) => node && node.id && node.type) // Filter out invalid nodes
    .map((node) => {
      const nodeType = node.type || 'unknown';
      const definition = getNodeDefinition(nodeType);

      // Determine category from definition or infer from type prefix
      let category: 'trigger' | 'condition' | 'action' = 'action';
      if (definition) {
        category = definition.category;
      } else if (
        nodeType.startsWith('trigger.') ||
        nodeType.startsWith('order.') ||
        nodeType.startsWith('payment.') ||
        nodeType.startsWith('event.') ||
        nodeType.startsWith('device.') ||
        nodeType.startsWith('schedule.') ||
        nodeType.startsWith('webhook.') ||
        nodeType.startsWith('stock.') ||
        nodeType.startsWith('product.') ||
        nodeType.startsWith('printer.')
      ) {
        category = 'trigger';
      } else if (nodeType.startsWith('condition.')) {
        category = 'condition';
      }

      console.log('Converting node:', nodeType, '-> category:', category, 'definition:', definition?.label);

      return {
        id: node.id,
        type: category,
        position: node.position || { x: 0, y: 0 },
        data: {
          label: definition?.label || nodeType,
          type: nodeType,
          config: node.data || {},
        },
      };
    });
}

// Convert workflow edges to ReactFlow edges
function toReactFlowEdges(edges: WorkflowEdge[]): Edge[] {
  if (!edges || !Array.isArray(edges)) return [];

  return edges
    .filter((edge) => edge && edge.id && edge.source && edge.target)
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
      animated: true,
      style: { stroke: '#94a3b8' },
    }));
}

// Convert ReactFlow nodes back to workflow nodes
function toWorkflowNodes(nodes: Node[]): WorkflowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.data.type as string,
    data: (node.data.config as Record<string, unknown>) || {},
    position: node.position,
  }));
}

// Convert ReactFlow edges back to workflow edges
function toWorkflowEdges(edges: Edge[]): WorkflowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
    label: edge.label as string | undefined,
  }));
}

let nodeId = 0;
const getNodeId = () => `node_${nodeId++}`;

function WorkflowBuilderInner({
  workflow,
  organizationId,
  onSave,
  onBack,
  isSaving,
}: WorkflowBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    workflow?.nodes ? toReactFlowNodes(workflow.nodes) : []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    workflow?.edges ? toReactFlowEdges(workflow.edges) : []
  );
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState(workflow?.name || '');
  const [workflowDescription, setWorkflowDescription] = useState(workflow?.description || '');
  const [loadedWorkflowId, setLoadedWorkflowId] = useState<string | null>(null);

  // Update nodes, edges and form fields when workflow data loads or changes
  useEffect(() => {
    // Skip if workflow hasn't loaded yet or if we already loaded this workflow
    if (!workflow || workflow.id === loadedWorkflowId) return;

    console.log('Loading workflow:', workflow.id);
    console.log('Raw workflow data:', JSON.stringify(workflow, null, 2));
    console.log('Nodes from backend:', workflow.nodes);
    console.log('Edges from backend:', workflow.edges);

    const convertedNodes = toReactFlowNodes(workflow.nodes || []);
    const convertedEdges = toReactFlowEdges(workflow.edges || []);

    console.log('Converted nodes:', convertedNodes);
    console.log('Converted edges:', convertedEdges);

    setNodes(convertedNodes);
    setEdges(convertedEdges);
    setWorkflowName(workflow.name || '');
    setWorkflowDescription(workflow.description || '');
    setLoadedWorkflowId(workflow.id);
  }, [workflow, loadedWorkflowId, setNodes, setEdges]);

  // Handle connecting nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `edge_${connection.source}_${connection.target}`,
            animated: true,
            style: { stroke: '#94a3b8' },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // Handle click on canvas (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Handle drag start from sidebar
  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string, nodeCategory: string) => {
      event.dataTransfer.setData('application/reactflow-type', nodeType);
      event.dataTransfer.setData('application/reactflow-category', nodeCategory);
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  // Handle drop on canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow-type');
      const nodeCategory = event.dataTransfer.getData('application/reactflow-category');

      if (!nodeType || !reactFlowWrapper.current) return;

      const definition = getNodeDefinition(nodeType);
      if (!definition) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 90,
        y: event.clientY - bounds.top - 30,
      };

      const newNode: Node = {
        id: getNodeId(),
        type: nodeCategory,
        position,
        data: {
          label: definition.label,
          type: nodeType,
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  // Handle node config update
  const onNodeUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  // Handle node delete
  const onNodeDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  // Handle save
  const handleSave = () => {
    // Find the trigger node to determine triggerType
    const triggerNode = nodes.find((node) => node.type === 'trigger');
    const triggerType = triggerNode ? (triggerNode.data.type as string) : 'trigger.manual';

    const workflowNodes = toWorkflowNodes(nodes);
    const workflowEdges = toWorkflowEdges(edges);

    console.log('Saving workflow:');
    console.log('ReactFlow nodes:', nodes);
    console.log('Converted workflow nodes:', workflowNodes);
    console.log('ReactFlow edges:', edges);
    console.log('Converted workflow edges:', workflowEdges);

    onSave({
      name: workflowName,
      description: workflowDescription,
      nodes: workflowNodes,
      edges: workflowEdges,
      triggerType,
    });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col border-secondary bg-primary lg:h-screen lg:rounded-none lg:border-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary px-4 py-3">
        <div className="flex items-center gap-4">
          <Button color="tertiary" size="sm" iconLeading={ArrowLeft} onClick={onBack}>
            Zurück
          </Button>
          <div className="h-6 w-px bg-secondary" />
          <div className="flex items-center gap-3">
            <Input
              size="sm"
              placeholder="Workflow-Name"
              value={workflowName}
              onChange={setWorkflowName}
              className="w-48"
            />
            <Input
              size="sm"
              placeholder="Beschreibung (optional)"
              value={workflowDescription}
              onChange={setWorkflowDescription}
              className="w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            color="secondary"
            size="sm"
            iconLeading={Play}
            isDisabled={nodes.length === 0}
          >
            Testen
          </Button>
          <Button
            color="primary"
            size="sm"
            iconLeading={Check}
            onClick={handleSave}
            isLoading={isSaving}
            isDisabled={!workflowName || nodes.length === 0}
          >
            Speichern
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node Sidebar */}
        <NodeSidebar onDragStart={onDragStart} />

        {/* React Flow Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#94a3b8', strokeWidth: 2 },
            }}
          >
            <Controls />
            <MiniMap
              nodeStrokeColor={(n) => {
                if (n.type === 'trigger') return '#10B981';
                if (n.type === 'condition') return '#F59E0B';
                return '#3B82F6';
              }}
              nodeColor={(n) => {
                if (n.type === 'trigger') return '#D1FAE5';
                if (n.type === 'condition') return '#FEF3C7';
                return '#DBEAFE';
              }}
            />
            <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
          </ReactFlow>
        </div>

        {/* Config Panel */}
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdate={onNodeUpdate}
          onDelete={onNodeDelete}
        />
      </div>
    </div>
  );
}

export function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
