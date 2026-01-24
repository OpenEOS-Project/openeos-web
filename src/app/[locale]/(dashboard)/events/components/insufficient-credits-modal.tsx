'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CoinsStacked01 } from '@untitledui/icons';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Button } from '@/components/ui/buttons/button';

interface InsufficientCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditsNeeded?: number;
  creditsAvailable?: number;
}

export function InsufficientCreditsModal({
  isOpen,
  onClose,
  creditsNeeded,
  creditsAvailable,
}: InsufficientCreditsModalProps) {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const handleBuyCredits = () => {
    onClose();
    router.push('/billing');
  };

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('insufficientCredits.title')}
    >
      <div className="px-6 py-4">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-secondary">
            <CoinsStacked01 className="h-6 w-6 text-warning-primary" />
          </div>
          <p className="text-sm text-tertiary">
            {t('insufficientCredits.description')}
          </p>

          {creditsNeeded !== undefined && creditsAvailable !== undefined && (
            <div className="mt-4 w-full rounded-lg bg-secondary p-4">
              <div className="flex justify-between text-sm">
                <span className="text-tertiary">{t('insufficientCredits.needed')}:</span>
                <span className="font-semibold text-primary">{creditsNeeded}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-tertiary">{t('insufficientCredits.available')}:</span>
                <span className="font-semibold text-primary">{creditsAvailable}</span>
              </div>
              <div className="mt-2 border-t border-tertiary/20 pt-2 flex justify-between text-sm">
                <span className="text-tertiary">{t('insufficientCredits.missing')}:</span>
                <span className="font-semibold text-error-primary">
                  {creditsNeeded - creditsAvailable}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
        <Button type="button" color="secondary" onClick={onClose}>
          {tCommon('cancel')}
        </Button>
        <Button onClick={handleBuyCredits}>
          {t('insufficientCredits.buyCredits')}
        </Button>
      </div>
    </DialogModal>
  );
}
