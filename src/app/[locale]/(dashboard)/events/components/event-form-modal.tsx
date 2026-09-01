'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCreateEvent, useUpdateEvent } from '@/hooks/use-events';
import { SHOP_URL, shopUrlForEvent } from '@/lib/shop-url';
import { useAuthStore } from '@/stores/auth-store';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { composeEventRange, countEventDays, deriveShopWindows, splitEventRange } from '@/lib/event-schedule';
import type { Event } from '@/types';
import { ApiException } from '@/types/api';

const DAY_FORMAT = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const TIME_FORMAT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

function formatRange(start: Date, end: Date): string {
  return `${DAY_FORMAT.format(start)} ${TIME_FORMAT.format(start)} – ${DAY_FORMAT.format(end)} ${TIME_FORMAT.format(end)}`;
}

const eventSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().optional(),
    startDate: z.string().min(1, 'Beginn ist erforderlich'),
    startTime: z.string().optional(),
    multiDay: z.boolean().optional(),
    endDate: z.string().optional(),
    endTime: z.string().optional(),
    shopEnabled: z.boolean().optional(),
    shopServiceFee: z.string().optional(),
  })
  // Nur der mehrtaegige Fall braucht eine Reihenfolgepruefung. Bei einem
  // einzelnen Tag ist eine Endzeit vor der Startzeit keine Falscheingabe,
  // sondern die Nacht danach.
  .refine((data) => !data.multiDay || !data.endDate || data.endDate >= data.startDate, {
    path: ['endDate'],
    message: 'Das Ende darf nicht vor dem Beginn liegen',
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      startTime: '',
      multiDay: false,
      endDate: '',
      endTime: '',
      shopEnabled: false,
      shopServiceFee: '',
    },
  });

  const watched = watch();
  const range = composeEventRange({
    startDate: watched.startDate ?? '',
    startTime: watched.startTime ?? '',
    endDate: watched.endDate ?? '',
    endTime: watched.endTime ?? '',
    multiDay: !!watched.multiDay,
  });
  const days = range ? countEventDays(range.start, range.end) : 0;
  const windows = range ? deriveShopWindows(range.start, range.end) : [];

  useEffect(() => {
    if (event) {
      const fee = event.settings?.shop?.serviceFee;
      const dates = splitEventRange(event.startDate, event.endDate);
      reset({
        name: event.name,
        description: event.description || '',
        ...dates,
        shopEnabled: event.settings?.shop?.enabled === true,
        shopServiceFee: typeof fee === 'number' && fee > 0 ? String(fee) : '',
      });
    } else {
      reset({
        name: '',
        description: '',
        startDate: '',
        startTime: '',
        multiDay: false,
        endDate: '',
        endTime: '',
        shopEnabled: false,
        shopServiceFee: '',
      });
    }
  }, [event, reset]);

  const onSubmit = async (data: EventFormData) => {
    if (!organizationId) return;
    setError(null);

    try {
      const parsedFee = parseFloat(String(data.shopServiceFee ?? '').replace(',', '.'));
      const serviceFee = Number.isFinite(parsedFee) && parsedFee > 0 ? Math.round(parsedFee * 100) / 100 : undefined;
      // Neue und bearbeitete Shops richten sich nach dem Veranstaltungszeitraum.
      // Die Wochentags-Tabelle wird nicht mehr gepflegt; ein Bestandsshop
      // wechselt in dem Moment, in dem er hier gespeichert wird.
      const shopSettings = {
        enabled: !!data.shopEnabled,
        hoursMode: 'event' as const,
        serviceFee,
      };

      const composed = composeEventRange({
        startDate: data.startDate,
        startTime: data.startTime ?? '',
        endDate: data.endDate ?? '',
        endTime: data.endTime ?? '',
        multiDay: !!data.multiDay,
      });
      if (!composed) {
        setError(t('form.startRequired'));
        return;
      }

      if (isEditing && event) {
        await updateEvent.mutateAsync({
          organizationId,
          id: event.id,
          data: {
            name: data.name,
            description: data.description || undefined,
            startDate: composed.start.toISOString(),
            endDate: composed.end.toISOString(),
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
            startDate: composed.start.toISOString(),
            endDate: composed.end.toISOString(),
            settings: { shop: shopSettings },
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
      <div className="modal__panel modal__panel--md" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{isEditing ? t('actions.edit') : t('create')}</h2>
          <DialogCloseButton onClick={handleClose} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <label className="auth-field" style={errors.name ? { '--field-border': 'var(--danger)' } as React.CSSProperties : {}}>
                  <span>{t('form.name')} <span style={{ color: 'var(--danger)' }}>*</span></span>
                  <input
                    type="text"
                    placeholder={t('form.namePlaceholder')}
                    {...field}
                  />
                  {errors.name && (
                    <span style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.name.message}</span>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <label
                      className="auth-field"
                      style={errors.startDate ? ({ '--field-border': 'var(--danger)' } as React.CSSProperties) : {}}
                    >
                      <span>
                        {t('form.start')} <span style={{ color: 'var(--danger)' }}>*</span>
                      </span>
                      <input type="date" {...field} />
                    </label>
                  )}
                />
                <Controller
                  name="startTime"
                  control={control}
                  render={({ field }) => (
                    <label className="auth-field">
                      <span>&nbsp;</span>
                      <input type="time" {...field} />
                    </label>
                  )}
                />
              </div>
              {errors.startDate && (
                <span style={{ fontSize: 12, color: 'var(--danger)' }}>{t('form.startRequired')}</span>
              )}

              <Controller
                name="multiDay"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!value}
                      onChange={(e) => onChange(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: 'var(--green-ink)' }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--ink)' }}>{t('form.multiDay')}</span>
                  </label>
                )}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                {watched.multiDay ? (
                  <Controller
                    name="endDate"
                    control={control}
                    render={({ field }) => (
                      <label
                        className="auth-field"
                        style={errors.endDate ? ({ '--field-border': 'var(--danger)' } as React.CSSProperties) : {}}
                      >
                        <span>{t('form.lastDay')}</span>
                        <input type="date" min={watched.startDate || undefined} {...field} />
                      </label>
                    )}
                  />
                ) : (
                  <div style={{ alignSelf: 'end', fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', paddingBottom: 10 }}>
                    {t('form.multiDayHint')}
                  </div>
                )}
                <Controller
                  name="endTime"
                  control={control}
                  render={({ field }) => (
                    <label className="auth-field">
                      <span>{t('form.end')}</span>
                      <input type="time" {...field} />
                    </label>
                  )}
                />
              </div>
              {errors.endDate && (
                <span style={{ fontSize: 12, color: 'var(--danger)' }}>{t('form.endBeforeStart')}</span>
              )}

              {range && (
                <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                  {formatRange(range.start, range.end)} · {days === 1 ? 'ein Veranstaltungstag' : `${days} Veranstaltungstage`}
                </div>
              )}
            </div>

            <Controller
              name="shopEnabled"
              control={control}
              render={({ field: { value, onChange } }) => {
                const shopUrl = event ? shopUrlForEvent(event.id) : SHOP_URL;
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
                        {windows.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: 0 }}>
                            Bitte zuerst den Zeitraum der Veranstaltung eintragen.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {windows.map((w) => (
                              <div
                                key={w.start.toISOString()}
                                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'var(--ink)' }}
                              >
                                <span>{DAY_FORMAT.format(w.start)}</span>
                                <span style={{ fontFamily: 'var(--f-mono)' }}>
                                  {TIME_FORMAT.format(w.start)} – {TIME_FORMAT.format(w.end)}
                                  {w.end.getDate() !== w.start.getDate() && (
                                    <span style={{ color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}> (+1)</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 8, marginBottom: 0 }}>
                          Der Shop öffnet zu den Zeiten der Veranstaltung — bei einer Endzeit vor der Startzeit über Mitternacht hinweg. Im Test-Modus ist er unabhängig davon erreichbar.
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
              <div role="alert" style={{ padding: '10px 14px', borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 10%, var(--paper))', color: 'var(--danger)', fontSize: 13 }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? tCommon('saving') : isEditing ? tCommon('save') : tCommon('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
