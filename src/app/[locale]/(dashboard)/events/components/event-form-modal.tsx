'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCreateEvent, useUpdateEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { Event } from '@/types';
import { ApiException } from '@/types/api';

const eventSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

interface EventFormModalProps {
  isOpen: boolean;
  event?: Event | null;
  onClose: () => void;
}

export function EventFormModal({ isOpen, event, onClose }: EventFormModalProps) {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const isEditing = !!event;
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';
  const [error, setError] = useState<string | null>(null);

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
    },
  });

  useEffect(() => {
    if (event) {
      reset({
        name: event.name,
        description: event.description || '',
        startDate: event.startDate ? event.startDate.split('T')[0] : '',
        endDate: event.endDate ? event.endDate.split('T')[0] : '',
      });
    } else {
      reset({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
      });
    }
  }, [event, reset]);

  const onSubmit = async (data: EventFormData) => {
    if (!organizationId) return;
    setError(null);

    try {
      if (isEditing && event) {
        await updateEvent.mutateAsync({
          organizationId,
          id: event.id,
          data: {
            name: data.name,
            description: data.description || undefined,
            startDate: data.startDate || undefined,
            endDate: data.endDate || undefined,
          },
        });
      } else {
        await createEvent.mutateAsync({
          organizationId,
          data: {
            name: data.name,
            description: data.description || undefined,
            startDate: data.startDate || undefined,
            endDate: data.endDate || undefined,
          },
        });
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError(tErrors('generic'));
      }
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" onClick={handleClose}>
      <div className="modal__panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{isEditing ? t('actions.edit') : t('create')}</h2>
          <button type="button" className="modal__close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <label className="auth-field" style={errors.name ? { '--field-border': '#d24545' } as React.CSSProperties : {}}>
                  <span>{t('form.name')} <span style={{ color: '#d24545' }}>*</span></span>
                  <input
                    type="text"
                    placeholder={t('form.namePlaceholder')}
                    {...field}
                  />
                  {errors.name && (
                    <span style={{ fontSize: 12, color: '#d24545', marginTop: 4 }}>{errors.name.message}</span>
                  )}
                </label>
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <label className="auth-field">
                  <span>{t('form.description')}</span>
                  <input
                    type="text"
                    placeholder={t('form.descriptionPlaceholder')}
                    {...field}
                  />
                </label>
              )}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <label className="auth-field">
                    <span>{t('form.startDate')}</span>
                    <input type="date" {...field} />
                  </label>
                )}
              />

              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <label className="auth-field">
                    <span>{t('form.endDate')}</span>
                    <input type="date" {...field} />
                  </label>
                )}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'color-mix(in oklab, #d24545 10%, var(--paper))', color: '#d24545', fontSize: 13 }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? '...' : isEditing ? tCommon('save') : tCommon('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
