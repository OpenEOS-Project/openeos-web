'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  useCreateInventoryCount,
  useBulkAddInventoryItems,
  useStartInventoryCount,
} from '@/hooks/use-inventory';
import { useProducts } from '@/hooks/use-products';
import type { InventoryCount } from '@/types/inventory';

interface CreateInventoryModalProps {
  isOpen: boolean;
  eventId: string;
  onClose: () => void;
  onCreated: (count: InventoryCount) => void;
}

function getTodayName() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `Tagesabschluss ${dd}.${mm}.${yyyy}`;
}

export function CreateInventoryModal({
  isOpen,
  eventId,
  onClose,
  onCreated,
}: CreateInventoryModalProps) {
  const t = useTranslations('inventory');
  const tCommon = useTranslations('common');

  const [name, setName] = useState(getTodayName());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: products } = useProducts(eventId);
  const createCount = useCreateInventoryCount(eventId);
  const bulkAdd = useBulkAddInventoryItems(eventId);
  const startCount = useStartInventoryCount(eventId);

  const handleClose = () => {
    setName(getTodayName());
    setNotes('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create the count
      const count = await createCount.mutateAsync({
        name: name.trim(),
        notes: notes.trim() || undefined,
      });

      // 2. Bulk-add all products with trackInventory=true
      const trackableProducts = (products ?? []).filter((p) => p.trackInventory);
      if (trackableProducts.length > 0) {
        await bulkAdd.mutateAsync({
          countId: count.id,
          data: { productIds: trackableProducts.map((p) => p.id) },
        });
      }

      // 3. Start the count
      const started = await startCount.mutateAsync(count.id);

      onCreated(started);
    } catch {
      setError(t('createError'));
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" onClick={handleClose}>
      <div className="modal__panel" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{t('create')}</h2>
          <button type="button" className="modal__close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label className="auth-field">
              <span>
                {t('form.name')} <span style={{ color: 'var(--danger)' }}>*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('form.namePlaceholder')}
                required
                autoFocus
              />
            </label>

            <label className="auth-field">
              <span>{t('form.notes')}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('form.notesPlaceholder')}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </label>

            {error && (
              <div style={{ fontSize: 13, color: 'var(--danger)', padding: '8px 12px', background: 'color-mix(in oklab, var(--danger) 10%, transparent)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {t('form.bulkAddHint', {
                count: (products ?? []).filter((p) => p.trackInventory).length,
              })}
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? t('creating') : t('createAndStart')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
