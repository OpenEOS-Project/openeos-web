'use client';

import type { ReactNode } from 'react';
import { XClose } from '@untitledui/icons';
import { ModalOverlay, Modal, Dialog } from './modal';
import { cx } from '@/utils/cx';

interface DialogModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
};

export function DialogModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  size = 'md',
}: DialogModalProps) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onClose()} isDismissable>
      <Modal className={cx(sizes[size], className)}>
        <Dialog>
          <div className="w-full rounded-xl bg-primary shadow-xl border border-secondary">
            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 border-b border-secondary px-6 py-4">
                <div>
                  {title && (
                    <h2 className="text-lg font-semibold text-primary">{title}</h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-tertiary">{description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-tertiary hover:bg-secondary hover:text-secondary transition-colors"
                  aria-label="Close"
                >
                  <XClose className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Content */}
            {children}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
