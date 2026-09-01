'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCreateEvent, useUpdateEvent } from '@/hooks/use-events';
import { SHOP_URL, shopUrlForEvent } from '@/lib/shop-url';
import {
  countEventDays,
  fromStoredDays,
  isOvernight,
  parseDayKey,
  syncShopDays,
  toDayKey,
  toIsoAtMidnight,
  toStoredDays,
  type ShopDayRow,
} from '@/lib/event-schedule';
import { useAuthStore } from '@/stores/auth-store';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import type { Event } from '@/types';
import { ApiException } from '@/types/api';
import { SettingToggle } from '@/components/shared/setting-toggle';

const DAY_FORMAT = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

const eventSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().optional(),
    startDate: z.string().min(1, 'Beginn ist erforderlich'),
    endDate: z.string().optional(),
    shopEnabled: z.boolean().optional(),
    shopServiceFee: z.string().optional(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    path: ['endDate'],
    message: 'Das Ende darf nicht vor dem Beginn liegen',
  });

type EventFormData = z.infer<typeof eventSchema>;

interface EventFormModalProps {
  isOpen: boolean;
  event?: Event | null;
  onClose: () => void;
}

const EMPTY_FORM: EventFormData = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  shopEnabled: false,
  shopServiceFee: '',
};

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

  /* Die Oeffnungstage stehen neben dem Formular, nicht darin: sie haengen am
     Zeitraum und werden bei jeder Datumsaenderung angeglichen. Ein
     Formularfeld je Tag wuerde bedeuten, Felder zur Laufzeit an- und
     abzumelden. */
  const [shopDays, setShopDays] = useState<ShopDayRow[]>([]);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: EMPTY_FORM,
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');

  useEffect(() => {
    if (event) {
      const fee = event.settings?.shop?.serviceFee;
      const start = event.startDate ? toDayKey(event.startDate) : '';
      const end = event.endDate ? toDayKey(event.endDate) : start;
      reset({
        name: event.name,
        description: event.description || '',
        startDate: start,
        endDate: end,
        shopEnabled: event.settings?.shop?.enabled === true,
        shopServiceFee: typeof fee === 'number' && fee > 0 ? String(fee) : '',
      });
      setShopDays(start ? fromStoredDays(start, end, event.settings?.shop?.days) : []);
    } else {
      reset(EMPTY_FORM);
      setShopDays([]);
    }
  }, [event, reset]);

  /* Der Zeitraum bestimmt, welche Tage es gibt. Schon eingestellte Tage
     behalten dabei ihre Uhrzeiten — siehe syncShopDays. */
  useEffect(() => {
    if (!startDate) {
      setShopDays([]);
      return;
    }
    setShopDays((previous) => syncShopDays(startDate, endDate || startDate, previous));
  }, [startDate, endDate]);

  const days = startDate ? countEventDays(startDate, endDate || startDate) : 0;

  const updateDay = (date: string, patch: Partial<ShopDayRow>) =>
    setShopDays((previous) =>
      previous.map((row) => (row.date === date ? { ...row, ...patch } : row)),
    );

  const onSubmit = async (data: EventFormData) => {
    if (!organizationId) return;
    setError(null);

    try {
      const parsedFee = parseFloat(String(data.shopServiceFee ?? '').replace(',', '.'));
      const serviceFee = Number.isFinite(parsedFee) && parsedFee > 0 ? Math.round(parsedFee * 100) / 100 : undefined;
      const shopSettings = {
        enabled: !!data.shopEnabled,
        hoursMode: 'event' as const,
        days: toStoredDays(shopDays),
        serviceFee,
      };

      const payload = {
        name: data.name,
        description: data.description || undefined,
        startDate: toIsoAtMidnight(data.startDate),
        endDate: toIsoAtMidnight(data.endDate || data.startDate),
      };

      if (isEditing && event) {
        await updateEvent.mutateAsync({
          organizationId,
          id: event.id,
          data: { ...payload, settings: { ...event.settings, shop: shopSettings } },
        });
      } else {
        await createEvent.mutateAsync({
          organizationId,
          data: { ...payload, settings: { shop: shopSettings } },
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
                  <input type="text" placeholder={t('form.namePlaceholder')} {...field} />
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
                  <input type="text" placeholder={t('form.descriptionPlaceholder')} {...field} />
                </label>
              )}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <label
                      className="auth-field"
                      style={errors.startDate ? ({ '--field-border': 'var(--danger)' } as React.CSSProperties) : {}}
                    >
                      <span>
                        {t('form.startDate')} <span style={{ color: 'var(--danger)' }}>*</span>
                      </span>
                      <input type="date" {...field} />
                    </label>
                  )}
                />
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <label
                      className="auth-field"
                      style={errors.endDate ? ({ '--field-border': 'var(--danger)' } as React.CSSProperties) : {}}
                    >
                      <span>{t('form.endDate')}</span>
                      <input type="date" min={startDate || undefined} {...field} />
                    </label>
                  )}
                />
              </div>
              {errors.startDate && (
                <span style={{ fontSize: 12, color: 'var(--danger)' }}>{t('form.startRequired')}</span>
              )}
              {errors.endDate && (
                <span style={{ fontSize: 12, color: 'var(--danger)' }}>{t('form.endBeforeStart')}</span>
              )}
              <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                {days > 0 ? t('form.dayCount', { days }) : t('form.endHint')}
              </span>
            </div>

            <Controller
              name="shopEnabled"
              control={control}
              render={({ field: { value, onChange } }) => {
                const shopUrl = event ? shopUrlForEvent(event.id) : SHOP_URL;
                return (
                  <SettingToggle
                    label="Online-Shop aktivieren"
                    hint="Kunden können Artikel des Events online bestellen und per Karte bezahlen."
                    checked={!!value}
                    onChange={onChange}
                  >
                    {event && (
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

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                        Öffnungszeiten
                      </div>

                        {shopDays.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: 0 }}>
                            Bitte zuerst den Zeitraum der Veranstaltung eintragen.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {shopDays.map((row) => (
                              <div
                                key={row.date}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '92px 18px 1fr 1fr 34px',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                                  {DAY_FORMAT.format(parseDayKey(row.date))}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={row.open}
                                  onChange={(e) => updateDay(row.date, { open: e.target.checked })}
                                  aria-label={`${DAY_FORMAT.format(parseDayKey(row.date))} geöffnet`}
                                  style={{ width: 16, height: 16, accentColor: 'var(--green-ink)', cursor: 'pointer' }}
                                />
                                <input
                                  type="time"
                                  value={row.start}
                                  disabled={!row.open}
                                  onChange={(e) => updateDay(row.date, { start: e.target.value })}
                                  style={{
                                    padding: '6px 8px', fontSize: 12, borderRadius: 6,
                                    border: '1px solid color-mix(in oklab, var(--ink) 12%, transparent)',
                                    background: 'var(--paper)', opacity: row.open ? 1 : 0.5,
                                  }}
                                />
                                <input
                                  type="time"
                                  value={row.end}
                                  disabled={!row.open}
                                  onChange={(e) => updateDay(row.date, { end: e.target.value })}
                                  style={{
                                    padding: '6px 8px', fontSize: 12, borderRadius: 6,
                                    border: '1px solid color-mix(in oklab, var(--ink) 12%, transparent)',
                                    background: 'var(--paper)', opacity: row.open ? 1 : 0.5,
                                  }}
                                />
                                {/* Ohne diesen Hinweis liest sich "10:00 – 02:00"
                                    wie ein Zahlendreher statt wie eine Nacht. */}
                                <span
                                  style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}
                                  title="Endet am Folgetag"
                                >
                                  {row.open && isOvernight(row) ? '+1' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 8, marginBottom: 0 }}>
                          Eine Endzeit vor der Startzeit bedeutet, dass der Shop über Mitternacht hinaus geöffnet
                          bleibt. Tage ohne Häkchen bleiben geschlossen. Im Test-Modus ist der Shop unabhängig
                          von den Öffnungszeiten erreichbar.
                        </p>
                    </div>

                    <div>
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
                  </SettingToggle>
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
