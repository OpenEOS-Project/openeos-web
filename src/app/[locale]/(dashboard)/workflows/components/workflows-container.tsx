'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/buttons/button';
import {
  useActivateWorkflow,
  useCreateWorkflow,
  useDeactivateWorkflow,
  useDeleteWorkflow,
  useUpdateWorkflow,
  useWorkflow,
} from '@/hooks/use-workflows';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import type { Workflow, WorkflowEdge, WorkflowNode } from '@/types/workflow';

import { WorkflowBuilder } from './workflow-builder';
import { WorkflowsList } from './workflows-list';

type View = 'list' | 'builder';

export function WorkflowsContainer() {
  const t = useTranslations('workflows');
  const tCommon = useTranslations('common');
  const { currentOrganization } = useAuthStore();
  const { setFullscreen } = useSidebarStore();
  const organizationId = currentOrganization?.organizationId;

  const [view, setView] = useState<View>('list');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<Workflow | null>(null);

  // Set fullscreen mode when in builder view
  useEffect(() => {
    setFullscreen(view === 'builder');
    return () => setFullscreen(false);
  }, [view, setFullscreen]);

  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const activateWorkflow = useActivateWorkflow();
  const deactivateWorkflow = useDeactivateWorkflow();

  // Fetch selected workflow details when editing
  const { data: selectedWorkflow, isLoading: isLoadingWorkflow } = useWorkflow(
    organizationId || '',
    selectedWorkflowId || ''
  );

  const handleCreateClick = () => {
    setSelectedWorkflowId(null);
    setView('builder');
  };

  const handleEditClick = (workflow: Workflow) => {
    setSelectedWorkflowId(workflow.id);
    setView('builder');
  };

  const handleBackToList = () => {
    setSelectedWorkflowId(null);
    setView('list');
  };

  const handleSave = async (data: {
    name: string;
    description: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    triggerType: string;
  }) => {
    if (!organizationId) return;

    console.log('WorkflowsContainer handleSave called with:', {
      name: data.name,
      nodes: data.nodes,
      edges: data.edges,
      triggerType: data.triggerType,
    });

    try {
      if (selectedWorkflowId) {
        // Update existing workflow
        const updateData = {
          name: data.name,
          description: data.description || null,
          triggerType: data.triggerType,
          nodes: data.nodes,
          edges: data.edges,
        };
        console.log('Sending update request:', updateData);
        await updateWorkflow.mutateAsync({
          organizationId,
          id: selectedWorkflowId,
          data: updateData,
        });
      } else {
        // Create new workflow
        const createData = {
          name: data.name,
          description: data.description,
          triggerType: data.triggerType,
          nodes: data.nodes,
          edges: data.edges,
          isActive: false,
        };
        console.log('Sending create request:', createData);
        await createWorkflow.mutateAsync({
          organizationId,
          data: createData,
        });
      }

      setView('list');
      setSelectedWorkflowId(null);
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  const handleDeleteClick = (workflow: Workflow) => {
    setDeletingWorkflow(workflow);
  };

  const handleDeleteConfirm = async () => {
    if (!organizationId || !deletingWorkflow) return;

    try {
      await deleteWorkflow.mutateAsync({
        organizationId,
        id: deletingWorkflow.id,
      });
      setDeletingWorkflow(null);
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  const handleToggleActive = async (workflow: Workflow) => {
    if (!organizationId) return;

    try {
      if (workflow.isActive) {
        await deactivateWorkflow.mutateAsync({
          organizationId,
          id: workflow.id,
        });
      } else {
        await activateWorkflow.mutateAsync({
          organizationId,
          id: workflow.id,
        });
      }
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
    }
  };

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-tertiary">Keine Organisation ausgewählt</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <>
          <div>
            <h1 className="text-display-sm font-semibold text-primary">{t('title')}</h1>
            <p className="mt-1 text-md text-tertiary">{t('subtitle')}</p>
          </div>

          <WorkflowsList
            organizationId={organizationId}
            onCreateClick={handleCreateClick}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            onToggleActive={handleToggleActive}
          />
        </>
      )}

      {view === 'builder' && (
        <>
          {/* Show loading state while fetching workflow for editing */}
          {selectedWorkflowId && isLoadingWorkflow ? (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center lg:h-screen">
              <div className="text-center">
                <div className="mx-auto size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                <p className="mt-4 text-sm text-tertiary">Workflow wird geladen...</p>
              </div>
            </div>
          ) : (
            <WorkflowBuilder
              workflow={selectedWorkflow || null}
              organizationId={organizationId}
              onSave={handleSave}
              onBack={handleBackToList}
              isSaving={createWorkflow.isPending || updateWorkflow.isPending}
            />
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deletingWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 backdrop-blur-[6px]">
          <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-primary">{t('deleteConfirm.title')}</h3>
            <p className="mt-2 text-sm text-tertiary">{t('deleteConfirm.message')}</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                color="secondary"
                onClick={() => setDeletingWorkflow(null)}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                color="primary-destructive"
                onClick={handleDeleteConfirm}
                isLoading={deleteWorkflow.isPending}
                isDisabled={deleteWorkflow.isPending}
              >
                {t('deleteConfirm.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
