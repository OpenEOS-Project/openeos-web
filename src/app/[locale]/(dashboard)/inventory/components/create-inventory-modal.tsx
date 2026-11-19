'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { Link } from '@/i18n/routing';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import {
  useCreateInventoryCount,
  useBulkAddInventoryItems,
  useDeleteInventoryCount,
  useStartInventoryCount,
} from '@/hooks/use-inventory';
import { useProducts } from '@/hooks/use-products';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import type { InventoryCount } from '@/types/inventory';

interface CreateInventoryModalProps {
  isOpen: boolean;
  eventId: string;
  onClose: () => void;
  onCreated: (count: InventoryCount) => void;
}


export function CreateInventoryModal({
  isOpen,
  eventId,
  onClose,
  onCreated,
}: CreateInventoryModalProps) {
  const t = useTranslations('inventory');
  const tCommon = useTranslations('common');
  const locale = useIntlLocale();

  // Vorschlag fuer den Namen: "Tagesabschluss 06.10.2026" in der UI-Sprache.
  const getTodayName = () =>
    t('form.defaultName', {
      date: new Date().toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    });

  const [name, setName] = useState(getTodayName);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorMessage = useApiErrorMessage();
  const { data: products } = useProducts(eventId);
  const createCount = useCreateInventoryCount(eventId);
  const bulkAdd = useBulkAddInventoryItems(eventId);
  const startCount = useStartInventoryCount(eventId);
  const deleteCount = useDeleteInventoryCount(eventId);

  // Gezählt werden nur Produkte mit „Bestand verfolgen“. Ohne solche
  // Produkte lehnt die API den Start ab — dann gar nicht erst anbieten.
  const trackableProducts = useMemo(
    () => (products ?? []).filter((p) => p.trackInventory),
    [products],
  );
  const noTrackableProducts = products !== undefined && trackableProducts.length === 0;

  const handleClose = () => {
    setName(getTodayName());
    setNotes('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !products || trackableProducts.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    // 1. Create the count (draft)
    let countId: string;
    try {
      const count = await createCount.mutateAsync({
        name: name.trim(),
        notes: notes.trim() || undefined,
      });
      countId = count.id;
    } catch (err) {
      setError(errorMessage(err, t('createError')));
      setIsSubmitting(false);
      return;
    }

    try {
      // 2. Bulk-add all products with trackInventory=true
      await bulkAdd.mutateAsync({
        countId,
        data: { productIds: trackableProducts.map((p) => p.id) },
      });

      // 3. Start the count
      const started = await startCount.mutateAsync(countId);

      onCreated(started);
    } catch (err) {
      // „Erstellen & Starten“ ist für dich ein Schritt: Startet die Inventur
      // nicht, wird der eben angelegte Entwurf wieder entfernt, statt als
      // verwaister Entwurf in der Liste zu bleiben. Gezeigt wird der Grund
      // der API, damit du weißt, was zu tun ist.
      await deleteCount.mutateAsync(countId).catch(() => undefined);
      setError(errorMessage(err, t('startError')));
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" onClick={handleClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{t('create')}</h2>
          <DialogCloseButton onClick={handleClose} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label className="auth-field">
              <span>
                {t('form.name')} <span className="auth-field__req">*</span>
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
              <div role="alert" style={{ fontSize: 13, color: 'var(--danger)', padding: '8px 12px', background: 'color-mix(in oklab, var(--danger) 10%, transparent)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            {noTrackableProducts ? (
              <div
                role="note"
                data-testid="inventory-no-tracked-products"
                style={{ fontSize: 13, color: 'var(--ink)', padding: '8px 12px', background: 'color-mix(in oklab, var(--warn) 14%, transparent)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}
              >
                <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, display: 'inline-flex' }}>
                  <Icon name="info" size={14} />
                </span>
                <span>
                  {t('form.noTrackedProducts')}{' '}
                  <Link href="/products" style={{ textDecoration: 'underline' }}>
                    {t('form.toProducts')}
                  </Link>
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="info" size={14} />
                {t('form.bulkAddHint', { count: trackableProducts.length })}
              </div>
            )}
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSubmitting || !name.trim() || !products || noTrackableProducts}
            >
              {isSubmitting ? t('creating') : t('createAndStart')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
