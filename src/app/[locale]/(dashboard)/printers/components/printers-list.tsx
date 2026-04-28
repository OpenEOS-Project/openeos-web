'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Printer,
  Edit05,
  Trash01,
  Send01,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { useAuthStore } from '@/stores/auth-store';
import { usePrinters, useTestPrint } from '@/hooks/use-printers';
import { PrinterFormModal } from './printer-form-modal';
import { DeletePrinterDialog } from './delete-printer-dialog';
import type { Printer as PrinterType } from '@/types/printer';
import type { BadgeColors } from '@/components/ui/badges/badge-types';

const typeConfig: Record<string, { color: BadgeColors }> = {
  receipt: { color: 'brand' },
  kitchen: { color: 'warning' },
  label: { color: 'gray' },
};

export function PrintersList() {
  const t = useTranslations('printers');
  const tCommon = useTranslations('common');
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId ?? '';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editPrinter, setEditPrinter] = useState<PrinterType | null>(null);
  const [deletePrinter, setDeletePrinter] = useState<PrinterType | null>(null);

  const { data: printers, isLoading } = usePrinters(organizationId);
  const testPrintMutation = useTestPrint(organizationId);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (!printers || printers.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
          <EmptyState
            icon="printer"
            title={t('noPrinters')}
            description={t('noPrintersDescription')}
            action={
              <Button
                size="sm"
                iconLeading={Plus}
                onClick={() => setShowCreateModal(true)}
              >
                {t('addPrinter')}
              </Button>
            }
          />
        </div>

        {showCreateModal && (
          <PrinterFormModal
            organizationId={organizationId}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-tertiary">
          {printers.length} {t('tabs.printers')}
        </p>
        <Button
          size="sm"
          iconLeading={Plus}
          onClick={() => setShowCreateModal(true)}
        >
          {t('addPrinter')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-secondary">
        <table className="w-full">
          <thead className="bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.name')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.type')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.connection')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.device')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.status')}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-tertiary">
                {t('table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary bg-primary">
            {printers.map((printer) => {
              const typeCfg = typeConfig[printer.type] || { color: 'gray' as const };

              return (
                <tr key={printer.id} className="hover:bg-secondary/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-tertiary">
                        <Printer className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-primary">{printer.name}</p>
                        <p className="text-xs text-tertiary">{printer.paperWidth}mm</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={typeCfg.color} size="sm">
                      {t(`types.${printer.type}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-secondary">
                      {t(`connectionTypes.${printer.connectionType}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {printer.device ? (
                      <span className="text-sm text-secondary">{printer.device.name}</span>
                    ) : (
                      <span className="text-sm text-tertiary">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          printer.isOnline ? 'bg-success-primary' : 'bg-tertiary'
                        }`}
                      />
                      <span className="text-sm text-secondary">
                        {printer.isOnline ? t('online') : t('offline')}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Dropdown.Root>
                      <Dropdown.DotsButton />
                      <Dropdown.Popover placement="bottom end">
                        <Dropdown.Menu>
                          <Dropdown.Item
                            onAction={() => setEditPrinter(printer)}
                            icon={Edit05}
                            label={t('editPrinter')}
                          />
                          <Dropdown.Item
                            onAction={() => testPrintMutation.mutate(printer.id)}
                            isDisabled={!printer.isOnline || testPrintMutation.isPending}
                            icon={Send01}
                            label={t('testPrint')}
                          />
                          <Dropdown.Item
                            onAction={() => setDeletePrinter(printer)}
                            className="text-error-primary"
                            icon={Trash01}
                            label={t('deletePrinter')}
                          />
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown.Root>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <PrinterFormModal
          organizationId={organizationId}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editPrinter && (
        <PrinterFormModal
          organizationId={organizationId}
          printer={editPrinter}
          onClose={() => setEditPrinter(null)}
        />
      )}

      {deletePrinter && (
        <DeletePrinterDialog
          printer={deletePrinter}
          onClose={() => setDeletePrinter(null)}
        />
      )}
    </>
  );
}
