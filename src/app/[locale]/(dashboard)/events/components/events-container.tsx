'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  useActivateEvent,
  useDeactivateEvent,
  useSetTestMode,
  useDeleteEvent,
  useEventBillingLookup,
  useSyncEventPayment,
} from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from '@/components/shared/toast';
import type { Event } from '@/types';
import type { EventBilling } from '@/types/billing';

import { EventCheckoutDialog } from './event-checkout-dialog';
import { EventFormModal } from './event-form-modal';
import { EventsList } from './events-list';

export function EventsContainer() {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [checkout, setCheckout] = useState<{ event: Event; billing: EventBilling } | null>(null);
  const [checkingEventId, setCheckingEventId] = useState<string | null>(null);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const deleteEvent = useDeleteEvent();
  const activateEvent = useActivateEvent();
  const deactivateEvent = useDeactivateEvent();
  const setTestMode = useSetTestMode();
  const billingLookup = useEventBillingLookup();
  const syncPayment = useSyncEventPayment();

  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentResult = searchParams.get('payment');
  const paidEventId = searchParams.get('eventId');
  // React ruft Effekte im Entwicklungsmodus doppelt auf. Ohne diese Sperre
  // liefe der Abgleich zweimal und der Nutzer sähe zwei Meldungen.
  const handledReturn = useRef<string | null>(null);

  useEffect(() => {
    if (!paymentResult || !organizationId) return;
    const marker = `${paymentResult}:${paidEventId ?? ''}`;
    if (handledReturn.current === marker) return;
    handledReturn.current = marker;

    // Den Rückkehr-Parameter aus der Adresszeile nehmen, damit ein Neuladen
    // die Meldung nicht wiederholt.
    router.replace('/events');

    if (paymentResult === 'cancelled') {
      toast.error(t('checkout.paymentCancelled'));
      return;
    }
    if (paymentResult !== 'success' || !paidEventId) return;

    void (async () => {
      try {
        const billing = await syncPayment.mutateAsync({ organizationId, id: paidEventId });
        if (billing.billingStatus === 'paid') {
          await activateEvent.mutateAsync({ organizationId, id: paidEventId });
          toast.success(t('checkout.success'));
        } else {
          // Der Webhook ist noch unterwegs. Die Zahlung ist dadurch nicht
          // verloren — die Veranstaltung lässt sich gleich erneut aktivieren.
          toast.error(t('checkout.paymentPending'));
        }
      } catch {
        toast.error(tErrors('generic'));
      }
    })();
  }, [paymentResult, paidEventId, organizationId, router, syncPayment, activateEvent, t, tErrors]);

  const handleCreateClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleEditClick = (event: Event) => {
    setEditingEvent(event);
  };

  const handleDeleteClick = (event: Event) => {
    setDeletingEvent(event);
  };

  const handleActivateClick = async (event: Event) => {
    if (!organizationId) return;
    setCheckingEventId(event.id);
    try {
      const billing = await billingLookup.mutateAsync({ organizationId, id: event.id });
      if (billing.billingStatus === 'paid' || billing.billingStatus === 'invoice' || billing.billingStatus === 'waived') {
        await activateEvent.mutateAsync({ organizationId, id: event.id });
      } else {
        setCheckout({ event, billing });
      }
    } catch {
      toast.error(tErrors('generic'));
    } finally {
      setCheckingEventId(null);
    }
  };

  const handleDeactivateClick = async (event: Event) => {
    if (!organizationId) return;
    try {
      await deactivateEvent.mutateAsync({ organizationId, id: event.id });
    } catch {
      // Error handled by mutation
    }
  };

  const handleSetTestModeClick = async (event: Event) => {
    if (!organizationId) return;
    try {
      await setTestMode.mutateAsync({ organizationId, id: event.id });
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEvent || !organizationId) return;

    try {
      await deleteEvent.mutateAsync({ organizationId, id: deletingEvent.id });
      setDeletingEvent(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingEvent(null);
  };

  return (
    <>
      <EventsList
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onActivateClick={handleActivateClick}
        onDeactivateClick={handleDeactivateClick}
        onSetTestModeClick={handleSetTestModeClick}
        activatingEventId={checkingEventId}
      />

      <EventFormModal
        isOpen={isCreateModalOpen || !!editingEvent}
        event={editingEvent}
        onClose={handleModalClose}
      />

      <EventCheckoutDialog
        event={checkout?.event ?? null}
        billing={checkout?.billing ?? null}
        organizationId={organizationId}
        onClose={() => setCheckout(null)}
      />

      {deletingEvent && (
        <div className="modal__overlay" onClick={() => setDeletingEvent(null)}>
          <div className="modal__panel modal__panel--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>{t('deleteConfirm.title')}</h2>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'var(--ink)', opacity: 0.7 }}>
                {t('deleteConfirm.message')}
              </p>
            </div>
            <div className="modal__foot">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDeletingEvent(null)}
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: 'var(--error, var(--danger))' }}
                onClick={handleDeleteConfirm}
                disabled={deleteEvent.isPending}
              >
                {deleteEvent.isPending ? tCommon('saving') : t('deleteConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
