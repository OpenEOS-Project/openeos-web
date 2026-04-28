'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getAllIcons, searchIcons, PosIcon } from '@openeos/pos-icons';
import type { PosIconEntry } from '@openeos/pos-icons';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';

interface PosIconPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconUrl: string) => void;
}

export function PosIconPicker({ isOpen, onClose, onSelect }: PosIconPickerProps) {
  const t = useTranslations('posIconPicker');
  const [query, setQuery] = useState('');

  const icons: PosIconEntry[] = useMemo(() => {
    if (query.trim()) {
      return searchIcons(query);
    }
    return getAllIcons();
  }, [query]);

  const handleSelect = (icon: PosIconEntry) => {
    onSelect(`pos-icon:${icon.id}`);
    setQuery('');
    onClose();
  };

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-lg">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">{t('title')}</h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Search */}
              <div className="px-6 pt-4">
                <Input
                  placeholder={t('search')}
                  value={query}
                  onChange={(v) => setQuery(v)}
                />
              </div>

              {/* Icon Grid */}
              <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
                {icons.length === 0 ? (
                  <p className="py-8 text-center text-sm text-tertiary">{t('noResults')}</p>
                ) : (
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                    {icons.map((icon) => (
                      <button
                        key={icon.id}
                        type="button"
                        onClick={() => handleSelect(icon)}
                        className="flex flex-col items-center gap-1.5 rounded-lg border border-secondary p-3 transition hover:border-brand-primary hover:bg-secondary"
                      >
                        <PosIcon id={icon.id} size={48} />
                        <span className="text-xs text-tertiary truncate w-full text-center">
                          {icon.id}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end border-t border-secondary px-6 py-3">
                <Button type="button" color="secondary" onClick={handleClose}>
                  {t('close')}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
