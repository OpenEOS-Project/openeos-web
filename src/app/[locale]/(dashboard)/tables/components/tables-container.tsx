'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Button, EmptyState, Icon, Spinner, type FloorChange, type FloorItemKind } from '@openeos/ui';

import { ListEmpty, ListError } from '@/components/shared/list-states';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useActiveEvent } from '@/hooks/use-events';
import {
  useBulkCreateTables,
  useCreateTable,
  useCreateTableArea,
  useDeleteTable,
  useDeleteTableArea,
  useOpenTableOrders,
  useReorderTableAreas,
  useTableAreas,
  useTablesLiveUpdates,
  useUpdateTable,
  useUpdateTableArea,
} from '@/hooks/use-tables';
import { useAuthStore } from '@/stores/auth-store';
import type {
  BulkCreateDiningTablesData,
  DiningTable,
  DiningTableShape,
  TableArea,
  TableDecor,
  TableDecorType,
  UpdateDiningTableData,
} from '@/types/table';

import { AreaTabs } from './area-tabs';
import { BulkCreateModal } from './bulk-create-modal';
import { FloorEditor, type FloorSelection } from './floor-editor';
import { TableInspector } from './table-inspector';
import { TablesList } from './tables-list';
import { TablesToolbar, type TablesView } from './tables-toolbar';
import { AreaDialog, ConfirmDialog, type AreaFormValues } from './tables-dialogs';
import { clampRect, findFreeSpot, makeDecor, newDecorId, nextTableLabel, tableDefaults } from './table-utils';
import { useLayoutDraft, type LayoutFields } from './use-layout-draft';

type DeleteTarget =
  | { kind: 'table'; table: DiningTable }
  | { kind: 'decor'; areaId: string; decor: TableDecor }
  | { kind: 'area'; area: TableArea };

const EXAMPLE = { prefix: 'A', start: 1, count: 12, padding: 2, seats: 6 } as const;

export function TablesContainer() {
  const t = useTranslations('tables');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();

  const organizationId = useAuthStore((s) => s.currentOrganization?.organizationId) ?? '';
  const areasQuery = useTableAreas(organizationId);
  const { data: activeEvent } = useActiveEvent(organizationId);
  const open = useOpenTableOrders(organizationId, activeEvent?.id);

  // Unter 768 px keine bearbeitbare Karte (Spezifikation §4.7).
  const canEditMap = useBreakpoint('md');

  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [view, setView] = useState<TablesView>('map');
  const [selection, setSelection] = useState<FloorSelection | null>(null);
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [areaDialog, setAreaDialog] = useState<{ area: TableArea | null } | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [creatingExample, setCreatingExample] = useState(false);

  const showError = useCallback(
    (error: unknown, fallback?: string) => toast.error(apiErrorMessage(error, fallback ?? t('toast.saveFailed'))),
    [apiErrorMessage, t],
  );

  const draft = useLayoutDraft(organizationId, (error) => showError(error));
  useTablesLiveUpdates(organizationId, draft.isBusy);

  const createArea = useCreateTableArea(organizationId);
  const updateArea = useUpdateTableArea(organizationId);
  const reorderAreas = useReorderTableAreas(organizationId);
  const deleteArea = useDeleteTableArea(organizationId);
  const createTable = useCreateTable(organizationId);
  const bulkCreate = useBulkCreateTables(organizationId);
  const updateTable = useUpdateTable(organizationId);
  const deleteTable = useDeleteTable(organizationId);

  const serverAreas = areasQuery.data;
  const areas = useMemo(() => (serverAreas ?? []).map(draft.apply), [serverAreas, draft.apply]);
  const activeArea = areas.find((a) => a.id === activeAreaId) ?? areas[0];

  // Erster Bereich als Start; nach dem Löschen der nächste.
  useEffect(() => {
    if (!serverAreas) return;
    if (!activeAreaId || !serverAreas.some((a) => a.id === activeAreaId)) {
      setActiveAreaId(serverAreas[0]?.id ?? null);
    }
  }, [serverAreas, activeAreaId]);

  // Auswahl, die es nicht mehr gibt (gelöscht, verschoben), aufheben.
  useEffect(() => {
    if (!selection || !activeArea) return;
    const exists =
      selection.kind === 'table'
        ? activeArea.tables.some((x) => x.id === selection.id)
        : activeArea.decor.some((x) => x.id === selection.id);
    if (!exists) setSelection(null);
  }, [selection, activeArea]);

  const selectArea = (areaId: string) => {
    if (activeArea) void draft.flush(activeArea.id);
    setSelection(null);
    setActiveAreaId(areaId);
  };

  /* ---------- Bereiche ---------- */

  const submitArea = async (values: AreaFormValues) => {
    setAreaError(null);
    try {
      if (areaDialog?.area) {
        await updateArea.mutateAsync({ areaId: areaDialog.area.id, data: values });
        toast.success(t('areas.saved'));
      } else {
        const area = await createArea.mutateAsync(values);
        setActiveAreaId(area.id);
        setSelection(null);
        toast.success(t('areas.created'));
      }
      setAreaDialog(null);
    } catch (error) {
      setAreaError(apiErrorMessage(error, t('toast.saveFailed')));
    }
  };

  const moveArea = (area: TableArea, direction: -1 | 1) => {
    const ids = areas.map((a) => a.id);
    const from = ids.indexOf(area.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorderAreas.mutate(ids, { onError: (error) => showError(error) });
  };

  const createExample = async () => {
    setCreatingExample(true);
    try {
      const area = await createArea.mutateAsync({ name: t('empty.exampleArea') });
      await bulkCreate.mutateAsync({
        areaId: area.id,
        ...EXAMPLE,
        shape: 'rect',
        layout: { cols: 6, gap: area.gridSize * 2 },
      });
      // Eine Theke unten rechts, damit die Karte nach etwas aussieht.
      await updateArea.mutateAsync({
        areaId: area.id,
        data: {
          decor: [
            {
              id: newDecorId(),
              type: 'bar',
              x: area.width - 400,
              y: area.height - 120,
              width: 320,
              height: 80,
              rotation: 0,
              label: t('decor.bar'),
            },
          ],
        },
      });
      setActiveAreaId(area.id);
      toast.success(t('empty.exampleCreated'));
    } catch (error) {
      showError(error);
    } finally {
      setCreatingExample(false);
    }
  };

  /* ---------- Tische ---------- */

  const addTable = (shape: DiningTableShape) => {
    if (!activeArea) return;
    const size = tableDefaults(shape);
    const spot = findFreeSpot(activeArea, size.width, size.height);
    const label = nextTableLabel(areas, activeArea);
    createTable.mutate(
      { areaId: activeArea.id, label, shape, ...size, ...spot },
      {
        onSuccess: (table) => {
          setSelection({ id: table.id, kind: 'table' });
          toast.success(t('toast.created', { label: table.label }));
        },
        onError: (error) => showError(error),
      },
    );
  };

  const changeLayout = (table: DiningTable, fields: Partial<LayoutFields>) => {
    draft.changeTable(table.areaId, table.id, fields);
  };

  const changeFields = async (table: DiningTable, data: UpdateDiningTableData) => {
    if (data.areaId && data.areaId !== table.areaId) {
      // Erst die Karte speichern, sonst kennt der alte Bereich den Tisch
      // beim Autosave nicht mehr.
      await draft.flush(table.areaId);
    }
    updateTable.mutate(
      { tableId: table.id, data },
      {
        onSuccess: (saved) => {
          if (data.areaId && saved.areaId !== table.areaId && view === 'map') {
            setActiveAreaId(saved.areaId);
            setSelection({ id: saved.id, kind: 'table' });
          }
        },
        onError: (error) => showError(error),
      },
    );
  };

  const duplicate = (id: string, kind: FloorItemKind) => {
    if (!activeArea) return;
    const grid = activeArea.gridSize || 20;
    if (kind === 'table') {
      const source = activeArea.tables.find((x) => x.id === id);
      if (!source) return;
      const near = clampRect(
        { x: source.x + source.width + grid, y: source.y, width: source.width, height: source.height },
        activeArea,
      );
      const free = activeArea.tables.some((x) => Math.abs(x.x - near.x) < grid && Math.abs(x.y - near.y) < grid)
        ? findFreeSpot(activeArea, source.width, source.height)
        : near;
      createTable.mutate(
        {
          areaId: activeArea.id,
          label: nextTableLabel(areas, activeArea, source.label),
          shape: source.shape,
          ...(source.seats ? { seats: source.seats } : {}),
          width: source.width,
          height: source.height,
          rotation: source.rotation,
          x: free.x,
          y: free.y,
        },
        {
          onSuccess: (table) => {
            setSelection({ id: table.id, kind: 'table' });
            toast.success(t('toast.created', { label: table.label }));
          },
          onError: (error) => showError(error),
        },
      );
    } else {
      const source = activeArea.decor.find((x) => x.id === id);
      if (!source) return;
      const copy = {
        ...source,
        id: newDecorId(),
        ...clampRect({ x: source.x + grid * 2, y: source.y + grid * 2, width: source.width, height: source.height }, activeArea),
      };
      draft.changeDecor(activeArea.id, [...activeArea.decor, copy]);
      setSelection({ id: copy.id, kind: 'decor' });
    }
  };

  const requestDelete = (id: string, kind: FloorItemKind) => {
    if (!activeArea) return;
    if (kind === 'table') {
      const table = activeArea.tables.find((x) => x.id === id);
      if (table) setDeleteTarget({ kind: 'table', table });
    } else {
      const decor = activeArea.decor.find((x) => x.id === id);
      if (decor) setDeleteTarget({ kind: 'decor', areaId: activeArea.id, decor });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'decor') {
      const area = areas.find((a) => a.id === deleteTarget.areaId);
      if (area) draft.changeDecor(area.id, area.decor.filter((d) => d.id !== deleteTarget.decor.id));
      setSelection(null);
      setDeleteTarget(null);
      return;
    }
    try {
      if (deleteTarget.kind === 'table') {
        await draft.flush(deleteTarget.table.areaId);
        await deleteTable.mutateAsync(deleteTarget.table.id);
        toast.success(t('toast.deleted', { label: deleteTarget.table.label }));
        setSelection(null);
      } else {
        await draft.flush(deleteTarget.area.id);
        await deleteArea.mutateAsync(deleteTarget.area.id);
        toast.success(t('areas.deleted'));
      }
    } catch (error) {
      showError(error);
    } finally {
      setDeleteTarget(null);
    }
  };

  /* ---------- Karte ---------- */

  const commit = (change: FloorChange) => {
    if (!activeArea) return;
    const { id, kind, ...rect } = change;
    const rounded = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      rotation: rect.rotation,
    };
    if (kind === 'table') {
      draft.changeTable(activeArea.id, id, rounded);
    } else {
      draft.changeDecor(
        activeArea.id,
        activeArea.decor.map((d) => (d.id === id ? { ...d, ...rounded } : d)),
      );
    }
  };

  const changeDecor = (decorId: string, fields: Partial<TableDecor>) => {
    if (!activeArea) return;
    draft.changeDecor(
      activeArea.id,
      activeArea.decor.map((d) => {
        if (d.id !== decorId) return d;
        const next = { ...d, ...fields };
        if (!next.label) delete next.label;
        return next;
      }),
    );
  };

  const addDecor = (type: TableDecorType) => {
    if (!activeArea) return;
    const item = makeDecor(activeArea, type, type === 'wall' ? undefined : t(`decor.${type}`));
    draft.changeDecor(activeArea.id, [...activeArea.decor, item]);
    setSelection({ id: item.id, kind: 'decor' });
  };

  const submitBulk = async (data: BulkCreateDiningTablesData) => {
    const created = await bulkCreate.mutateAsync(data);
    toast.success(t('bulk.created', { count: created.length }));
    setBulkOpen(false);
    if (data.areaId !== activeArea?.id) selectArea(data.areaId);
  };

  /* ---------- Darstellung ---------- */

  if (!organizationId) {
    return <ListEmpty title={tCommon('noOrganization.title')} description={tCommon('noOrganization.description')} />;
  }

  if (areasQuery.isLoading) {
    return (
      <div className="oe-card tables-loading">
        <Spinner />
      </div>
    );
  }

  if (areasQuery.error) {
    return <ListError onRetry={() => areasQuery.refetch()} />;
  }

  const effectiveView: TablesView = canEditMap ? view : 'list';

  const dialogs = (
    <>
      {areaDialog && (
        <AreaDialog
          area={areaDialog.area}
          pending={createArea.isPending || updateArea.isPending}
          error={areaError}
          onSubmit={submitArea}
          onClose={() => {
            setAreaDialog(null);
            setAreaError(null);
          }}
        />
      )}
      {bulkOpen && areas.length > 0 && (
        <BulkCreateModal
          areas={areas}
          defaultAreaId={activeArea?.id ?? ''}
          pending={bulkCreate.isPending}
          onSubmit={submitBulk}
          onClose={() => setBulkOpen(false)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={
            deleteTarget.kind === 'table'
              ? t('delete.title', { label: deleteTarget.table.label })
              : deleteTarget.kind === 'decor'
                ? t('delete.decorTitle', { name: deleteTarget.decor.label || t(`decor.${deleteTarget.decor.type}`) })
                : t('areas.deleteTitle', { name: deleteTarget.area.name })
          }
          text={
            deleteTarget.kind === 'table'
              ? t('delete.text')
              : deleteTarget.kind === 'decor'
                ? t('delete.decorText')
                : t('areas.deleteText', { count: deleteTarget.area.tables.length })
          }
          confirmLabel={tCommon('delete')}
          pending={deleteTable.isPending || deleteArea.isPending}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );

  if (areas.length === 0) {
    return (
      <>
        <div className="oe-card">
          <EmptyState
            className="tables-empty"
            icon={<Icon name="table" />}
            title={t('empty.title')}
            description={t('empty.text')}
            action={
              <div className="tables-empty__actions">
                <Button variant="primary" onClick={() => setAreaDialog({ area: null })}>
                  <Icon name="plus" />
                  {t('empty.createArea')}
                </Button>
                <Button variant="secondary" onClick={createExample} loading={creatingExample}>
                  <Icon name="grid" />
                  {t('empty.example')}
                </Button>
              </div>
            }
          />
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <AreaTabs
        areas={areas}
        activeId={activeArea?.id ?? null}
        onSelect={selectArea}
        onAdd={() => setAreaDialog({ area: null })}
        onEdit={(area) => setAreaDialog({ area })}
        onMove={moveArea}
        onDelete={(area) => setDeleteTarget({ kind: 'area', area })}
      />

      <TablesToolbar
        view={effectiveView}
        onViewChange={(next) => {
          setView(next);
          setSelection(null);
        }}
        canEditMap={canEditMap}
        snap={snap}
        onSnapChange={setSnap}
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        saveState={draft.state}
        busy={createTable.isPending}
        onAddTable={addTable}
        onBulk={() => setBulkOpen(true)}
        onAddDecor={addDecor}
      />

      {effectiveView === 'map' && activeArea ? (
        <div className="tables-workspace">
          <div className="tables-workspace__map">
            {activeArea.tables.length === 0 && (
              <Banner tone="info" icon={<Icon name="info" />}>
                {t('floor.empty')}
              </Banner>
            )}
            <FloorEditor
              area={activeArea}
              selection={selection}
              snap={snap}
              showGrid={showGrid}
              onSelect={setSelection}
              onCommit={commit}
              onDelete={requestDelete}
              onDuplicate={duplicate}
            />
            <p className="tables-muted tables-floor__hint">{t('floor.hint')}</p>
          </div>
          <TableInspector
            areas={areas}
            area={activeArea}
            selection={selection}
            onLayout={(tableId, fields) => draft.changeTable(activeArea.id, tableId, fields)}
            onUpdate={changeFields}
            onDecor={changeDecor}
            onDuplicate={duplicate}
            onDelete={requestDelete}
            onClose={() => setSelection(null)}
          />
        </div>
      ) : (
        <>
          <TablesList
            areas={areas}
            openCount={open.countFor}
            openLoading={open.isLoading && !!activeEvent}
            onUpdate={changeFields}
            onLayout={changeLayout}
            onDelete={(table) => setDeleteTarget({ kind: 'table', table })}
          />
          {!canEditMap && activeArea && (
            <section className="tables-preview" aria-label={t('floor.previewLabel', { name: activeArea.name })}>
              <Banner tone="info" icon={<Icon name="info" />}>
                {t('floor.mobileHint')}
              </Banner>
              <FloorEditor
                area={activeArea}
                mode="view"
                selection={null}
                snap={false}
                showGrid={false}
                onSelect={() => {}}
                onCommit={() => {}}
                onDelete={() => {}}
                onDuplicate={() => {}}
              />
            </section>
          )}
        </>
      )}

      {dialogs}
    </>
  );
}
