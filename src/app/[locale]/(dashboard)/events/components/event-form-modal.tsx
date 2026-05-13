'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCreateEvent, useUpdateEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { Event } from '@/types';
import type { ShopOpeningHours, ShopWeekday } from '@/types/event';
import { ApiException } from '@/types/api';

const WEEKDAYS: { key: ShopWeekday; label: string }[] = [
  { key: 'mon', label: 'Montag' },
  { key: 'tue', label: 'Dienstag' },
  { key: 'wed', label: 'Mittwoch' },
  { key: 'thu', label: 'Donnerstag' },
  { key: 'fri', label: 'Freitag' },
  { key: 'sat', label: 'Samstag' },
  { key: 'sun', label: 'Sonntag' },
];

const eventSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  shopEnabled: z.boolean().optional(),
  shopServiceFee: z.string().optional(),
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

  const [openingHours, setOpeningHours] = useState<ShopOpeningHours>({});

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
      shopEnabled: false,
      shopServiceFee: '',
    },
  });

  useEffect(() => {
    if (event) {
      const fee = event.settings?.shop?.serviceFee;
      reset({
        name: event.name,
        description: event.description || '',
        startDate: event.startDate ? event.startDate.split('T')[0] : '',
        endDate: event.endDate ? event.endDate.split('T')[0] : '',
        shopEnabled: event.settings?.shop?.enabled === true,
        shopServiceFee: typeof fee === 'number' && fee > 0 ? String(fee) : '',
      });
      setOpeningHours(event.settings?.shop?.openingHours ?? {});
    } else {
      reset({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        shopEnabled: false,
        shopServiceFee: '',
      });
      setOpeningHours({});
    }
  }, [event, reset]);

  const onSubmit = async (data: EventFormData) => {
    if (!organizationId) return;
    setError(null);

    try {
      const parsedFee = parseFloat(String(data.shopServiceFee ?? '').replace(',', '.'));
      const serviceFee = Number.isFinite(parsedFee) && parsedFee > 0 ? Math.round(parsedFee * 100) / 100 : undefined;
      const shopSettings = data.shopEnabled
        ? { enabled: true, openingHours, serviceFee }
        : { enabled: false, openingHours, serviceFee };
      if (isEditing && event) {
        await updateEvent.mutateAsync({
          organizationId,
          id: event.id,
          data: {
            name: data.name,
            description: data.description || undefined,
            startDate: data.startDate || undefined,
            endDate: data.endDate || undefined,
            settings: {
              ...event.settings,
              shop: shopSettings,
            },
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
            settings: data.shopEnabled
              ? { shop: shopSettings }
              : undefined,
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

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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

            <Controller
              name="shopEnabled"
              control={control}
              render={({ field: { value, onChange } }) => {
                const shopUrl = (process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004') + (event ? `/${event.id}` : '');
                return (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: '14px 16px',
                      background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))',
                      border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                      borderRadius: 10,
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!value}
                        onChange={(e) => onChange(e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: 'var(--green-ink)' }}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                          Online-Shop aktivieren
                        </div>
                        <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                          Kunden können Artikel des Events online bestellen und per Karte bezahlen.
                        </div>
                      </div>
                    </label>
                    {value && event && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <code
                          style={{
                            flex: 1,
                            fontSize: 12,
                            padding: '7px 10px',
                            borderRadius: 8,
                            border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                            background: 'var(--paper)',
                            color: 'var(--ink)',
                            fontFamily: 'var(--f-mono)',
                            wordBreak: 'break-all',
                          }}
                        >
                          {shopUrl}
                        </code>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ flexShrink: 0, padding: '7px 12px', fontSize: 12 }}
                          onClick={() => {
                            navigator.clipboard?.writeText(shopUrl);
                          }}
                        >
                          Link kopieren
                        </button>
                      </div>
                    )}
                    {value && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                          Öffnungszeiten
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {WEEKDAYS.map(({ key, label }) => {
                            const window = openingHours[key];
                            const open = window !== null && window !== undefined;
                            return (
                              <div key={key} style={{ display: 'grid', gridTemplateColumns: '110px 18px 1fr 1fr', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, color: 'var(--ink)' }}>{label}</span>
                                <input
                                  type="checkbox"
                                  checked={open}
                                  onChange={(e) =>
                                    setOpeningHours((prev) => ({
                                      ...prev,
                                      [key]: e.target.checked ? { start: prev[key]?.start ?? '10:00', end: prev[key]?.end ?? '22:00' } : null,
                                    }))
                                  }
                                  style={{ width: 16, height: 16, accentColor: 'var(--green-ink)', cursor: 'pointer' }}
                                />
                                <input
                                  type="time"
                                  value={window?.start ?? ''}
                                  disabled={!open}
                                  onChange={(e) =>
                                    setOpeningHours((prev) => ({
                                      ...prev,
                                      [key]: { start: e.target.value, end: prev[key]?.end ?? '22:00' },
                                    }))
                                  }
                                  style={{ padding: '6px 8px', fontSize: 12, border: '1px solid color-mix(in oklab, var(--ink) 12%, transparent)', borderRadius: 6, background: 'var(--paper)', opacity: open ? 1 : 0.5 }}
                                />
                                <input
                                  type="time"
                                  value={window?.end ?? ''}
                                  disabled={!open}
                                  onChange={(e) =>
                                    setOpeningHours((prev) => ({
                                      ...prev,
                                      [key]: { start: prev[key]?.start ?? '10:00', end: e.target.value },
                                    }))
                                  }
                                  style={{ padding: '6px 8px', fontSize: 12, border: '1px solid color-mix(in oklab, var(--ink) 12%, transparent)', borderRadius: 6, background: 'var(--paper)', opacity: open ? 1 : 0.5 }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 8, marginBottom: 0 }}>
                          Im Test-Modus ist der Shop unabhängig von Öffnungszeiten erreichbar. Tage ohne Häkchen bleiben geschlossen.
                        </p>
                      </div>
                    )}
                    {value && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                          Servicegebühr
                        </div>
                        <Controller
                          name="shopServiceFee"
                          control={control}
                          render={({ field: feeField }) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={feeField.value ?? ''}
                                onChange={(e) => feeField.onChange(e.target.value)}
                                style={{
                                  flex: 1,
                                  padding: '8px 10px',
                                  fontSize: 13,
                                  border: '1px solid color-mix(in oklab, var(--ink) 12%, transparent)',
                                  borderRadius: 6,
                                  background: 'var(--paper)',
                                  fontFamily: 'var(--f-mono)',
                                }}
                              />
                              <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                                EUR pro Bestellung
                              </span>
                            </div>
                          )}
                        />
                        <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 6, marginBottom: 0 }}>
                          Wird im Online-Shop pauschal pro Bestellung auf den Gesamtbetrag aufgeschlagen. Leer lassen für keine Gebühr.
                        </p>
                      </div>
                    )}
                  </div>
                );
              }}
            />

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
