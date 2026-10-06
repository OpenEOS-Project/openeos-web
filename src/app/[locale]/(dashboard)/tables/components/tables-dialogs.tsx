'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import type { TableArea } from '@/types/table';

import {
  AREA_SIZE_MAX,
  AREA_SIZE_MIN,
  GRID_SIZE_MAX,
  GRID_SIZE_MIN,
  parseIntOrNull,
} from './table-utils';

interface TablesModalProps {
  title: ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg';
  footer: ReactNode;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

/**
 * Dialograhmen der Tische-Seite im Muster der übrigen Verwaltung
 * (`modal__panel`), dazu Escape zum Schließen und Fokus auf das erste Feld.
 */
export function TablesModal({ title, onClose, size = 'md', footer, onSubmit, children }: TablesModalProps) {
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = bodyRef.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
    // Nur beim Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const body = (
    <>
      <div className="modal__body tables-modal__body" ref={bodyRef}>
        {children}
      </div>
      <div className="modal__foot">{footer}</div>
    </>
  );

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId={titleId} className={size === 'lg' ? 'modal__panel--lg' : 'modal__panel--md'}>
        <div className="modal__head">
          <h2 id={titleId}>{title}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        {onSubmit ? (
          <form onSubmit={onSubmit} className="tables-modal__form" noValidate>
            {body}
          </form>
        ) : (
          body
        )}
      </ModalPanel>
    </div>
  );
}

interface ConfirmDialogProps {
  title: ReactNode;
  text: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ title, text, confirmLabel, pending, onConfirm, onClose }: ConfirmDialogProps) {
  const tCommon = useTranslations('common');
  return (
    <TablesModal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {tCommon('cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="tables-muted">{text}</p>
    </TablesModal>
  );
}

export interface AreaFormValues {
  name: string;
  width: number;
  height: number;
  gridSize: number;
}

interface AreaDialogProps {
  area?: TableArea | null;
  pending?: boolean;
  error?: string | null;
  onSubmit: (values: AreaFormValues) => void;
  onClose: () => void;
}

/** Bereich anlegen bzw. bearbeiten (Name, Größe der Karte, Raster). */
export function AreaDialog({ area, pending, error, onSubmit, onClose }: AreaDialogProps) {
  const t = useTranslations('tables.areas');
  const tCommon = useTranslations('common');
  const [name, setName] = useState(area?.name ?? '');
  const [width, setWidth] = useState(String(area?.width ?? 1200));
  const [height, setHeight] = useState(String(area?.height ?? 800));
  const [grid, setGrid] = useState(String(area?.gridSize ?? 20));
  const [touched, setTouched] = useState(false);

  const w = parseIntOrNull(width);
  const h = parseIntOrNull(height);
  const g = parseIntOrNull(grid);
  const nameError = touched && !name.trim() ? t('nameRequired') : undefined;
  const sizeOk = (v: number | null) => v !== null && v >= AREA_SIZE_MIN && v <= AREA_SIZE_MAX;
  const gridOk = g !== null && g >= GRID_SIZE_MIN && g <= GRID_SIZE_MAX;
  const sizeError = touched && (!sizeOk(w) || !sizeOk(h)) ? t('sizeRange', { min: AREA_SIZE_MIN, max: AREA_SIZE_MAX }) : undefined;
  const gridError = touched && !gridOk ? t('gridRange', { min: GRID_SIZE_MIN, max: GRID_SIZE_MAX }) : undefined;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!name.trim() || !sizeOk(w) || !sizeOk(h) || !gridOk) return;
    onSubmit({ name: name.trim(), width: w!, height: h!, gridSize: g! });
  };

  return (
    <TablesModal
      title={area ? t('editTitle') : t('addTitle')}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {area ? tCommon('save') : tCommon('create')}
          </Button>
        </>
      }
    >
      <Input
        label={t('name')}
        value={name}
        maxLength={60}
        placeholder={t('namePlaceholder')}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
        required
      />
      <div className="tables-grid-3">
        <Input
          label={t('width')}
          type="number"
          inputMode="numeric"
          min={AREA_SIZE_MIN}
          max={AREA_SIZE_MAX}
          value={width}
          onChange={(e) => setWidth(e.target.value)}
        />
        <Input
          label={t('height')}
          type="number"
          inputMode="numeric"
          min={AREA_SIZE_MIN}
          max={AREA_SIZE_MAX}
          value={height}
          onChange={(e) => setHeight(e.target.value)}
        />
        <Input
          label={t('gridSize')}
          type="number"
          inputMode="numeric"
          min={GRID_SIZE_MIN}
          max={GRID_SIZE_MAX}
          value={grid}
          onChange={(e) => setGrid(e.target.value)}
        />
      </div>
      <p className={sizeError || gridError ? 'tables-error' : 'tables-muted'} role={sizeError || gridError ? 'alert' : undefined}>
        {sizeError ?? gridError ?? t('sizeHint')}
      </p>
      {error && (
        <p className="tables-error" role="alert">
          {error}
        </p>
      )}
    </TablesModal>
  );
}
