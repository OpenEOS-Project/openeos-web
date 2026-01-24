'use client';

import { useTranslations } from 'next-intl';
import { Edit01, Play, Power01, Plus, Trash01, Zap } from '@untitledui/icons';

import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Table, TableCard } from '@/components/ui/table/table';
import { useWorkflows } from '@/hooks/use-workflows';
import type { Workflow } from '@/types/workflow';

interface WorkflowsListProps {
  organizationId: string;
  onCreateClick: () => void;
  onEditClick: (workflow: Workflow) => void;
  onDeleteClick: (workflow: Workflow) => void;
  onToggleActive: (workflow: Workflow) => void;
}

export function WorkflowsList({
  organizationId,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onToggleActive,
}: WorkflowsListProps) {
  const t = useTranslations('workflows');
  const tCommon = useTranslations('common');

  const { data: workflows, isLoading, error } = useWorkflows(organizationId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-tertiary">{tCommon('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="text-error-primary">{tCommon('error')}</div>
        <Button color="secondary" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  if (!workflows || workflows.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="zap"
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button iconLeading={Plus} onClick={onCreateClick}>
              {t('create')}
            </Button>
          }
        />
      </div>
    );
  }

  const getTriggerLabel = (triggerType: string) => {
    const labels: Record<string, string> = {
      'trigger.order.created': 'Bestellung erstellt',
      'trigger.order.completed': 'Bestellung abgeschlossen',
      'trigger.order.cancelled': 'Bestellung storniert',
      'trigger.order.item.ready': 'Artikel fertig',
      'trigger.payment.captured': 'Zahlung erhalten',
      'trigger.stock.low': 'Niedriger Bestand',
      'trigger.manual': 'Manuell',
      order_created: 'Bestellung erstellt',
      order_item_ready: 'Artikel fertig',
      order_completed: 'Bestellung abgeschlossen',
      payment_received: 'Zahlung erhalten',
      low_stock: 'Niedriger Bestand',
      manual: 'Manuell',
    };
    return labels[triggerType] || triggerType;
  };

  return (
    <TableCard.Root>
      <TableCard.Header
        title={t('title')}
        badge={workflows.length}
        description={t('subtitle')}
        contentTrailing={
          <Button iconLeading={Plus} onClick={onCreateClick}>
            {t('create')}
          </Button>
        }
      />
      <Table aria-label={t('title')}>
        <Table.Header>
          <Table.Head label={t('table.name')} isRowHeader />
          <Table.Head label={t('table.trigger')} />
          <Table.Head label={t('table.nodes')} />
          <Table.Head label={t('table.status')} />
          <Table.Head label={t('table.actions')} />
        </Table.Header>
        <Table.Body items={workflows}>
          {(workflow) => (
            <Table.Row key={workflow.id} id={workflow.id}>
              <Table.Cell>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950">
                    <Zap className="size-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary">{workflow.name}</p>
                    {workflow.description && (
                      <p className="text-xs text-tertiary">{workflow.description}</p>
                    )}
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <Badge color="gray" size="sm">
                  {getTriggerLabel(workflow.triggerType)}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm text-tertiary">
                  {workflow.nodes?.length || 0} {t('table.nodesCount')}
                </span>
              </Table.Cell>
              <Table.Cell>
                {workflow.isActive ? (
                  <Badge color="success" size="sm">{t('status.active')}</Badge>
                ) : (
                  <Badge color="gray" size="sm">{t('status.inactive')}</Badge>
                )}
                {workflow.isSystem && (
                  <Badge color="blue" size="sm" className="ml-1">{t('status.system')}</Badge>
                )}
              </Table.Cell>
              <Table.Cell>
                <Dropdown.Root>
                  <Dropdown.DotsButton />
                  <Dropdown.Popover className="w-min">
                    <Dropdown.Menu>
                      <Dropdown.Item icon={Edit01} onAction={() => onEditClick(workflow)}>
                        <span className="pr-4">{t('actions.edit')}</span>
                      </Dropdown.Item>
                      {!workflow.isSystem && (
                        <>
                          <Dropdown.Item
                            icon={workflow.isActive ? Power01 : Play}
                            onAction={() => onToggleActive(workflow)}
                          >
                            <span className="pr-4">
                              {workflow.isActive ? t('actions.deactivate') : t('actions.activate')}
                            </span>
                          </Dropdown.Item>
                          <Dropdown.Separator />
                          <Dropdown.Item
                            icon={Trash01}
                            className="text-error-primary"
                            onAction={() => onDeleteClick(workflow)}
                          >
                            <span className="pr-4">{t('actions.delete')}</span>
                          </Dropdown.Item>
                        </>
                      )}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.Root>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    </TableCard.Root>
  );
}
