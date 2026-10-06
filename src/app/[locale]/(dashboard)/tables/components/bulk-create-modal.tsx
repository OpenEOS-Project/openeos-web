'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Segment, Select } from '@openeos/ui';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { ApiException } from '@/types/api';
import type { BulkCreateDiningTablesData, DiningTableShape, TableArea } from '@/types/table';
import { toTableKey } from '@/types/table';

import { TablesModal } from './tables-dialogs';
import { BULK_MAX, LABEL_MAX, SEATS_MAX, bulkLabels, parseIntOrNull, takenKeys } from './table-utils';

interface BulkCreateModalProps {
  areas: TableArea[];
  defaultAreaId: string;
  pending?: boolean;
  onSubmit: (data: BulkCreateDiningTablesData) => Promise<unknown>;
  onClose: () => void;
}

/** Präfix aus den vorhandenen Bezeichnungen raten: „A07“ → „A“. */
function guessPrefix(area: TableArea | undefined): string {
  const last = area?.tables.at(-1)?.label;
  const match = last ? /^(.*?)\d+$/.exec(last) : null;
  return match ? match[1] : '';
}

const PREVIEW_MAX = 40;

/**
 * Serie anlegen, z. B. A01–A12 (Spezifikation §4.2). Die Vorschau zeigt
 * die Bezeichnungen als Tisch-Kacheln; was es org-weit schon gibt, ist
 * markiert und sperrt das Anlegen. Kommt trotzdem ein 409 (jemand war
 * schneller), markiert die Vorschau die Bezeichnungen aus der Antwort.
 */
export function BulkCreateModal({ areas, defaultAreaId, pending, onSubmit, onClose }: BulkCreateModalProps) {
  const t = useTranslations('tables.bulk');
  const tShape = useTranslations('tables.shape');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();

  const initialArea = areas.find((a) => a.id === defaultAreaId) ?? areas[0];
  const [areaId, setAreaId] = useState(initialArea?.id ?? '');
  const [prefix, setPrefix] = useState(guessPrefix(initialArea) || 'A');
  const [start, setStart] = useState('1');
  const [count, setCount] = useState('12');
  const [padding, setPadding] = useState('2');
  const [seats, setSeats] = useState('');
  const [shape, setShape] = useState<DiningTableShape>('rect');
  const [cols, setCols] = useState('6');
  const [serverConflicts, setServerConflicts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startN = parseIntOrNull(start);
  const countN = parseIntOrNull(count);
  const paddingN = parseIntOrNull(padding);
  const seatsN = seats.trim() ? parseIntOrNull(seats) : null;
  const colsN = parseIntOrNull(cols);
  const area = areas.find((a) => a.id === areaId);

  const countOk = countN !== null && countN >= 1 && countN <= BULK_MAX;
  const startOk = startN !== null && startN >= 0 && startN <= 99999;
  const paddingOk = paddingN !== null && paddingN >= 0 && paddingN <= 3;
  const seatsOk = !seats.trim() || (seatsN !== null && seatsN >= 1 && seatsN <= SEATS_MAX);
  const colsOk = colsN !== null && colsN >= 1 && colsN <= 50;
  const prefixOk = prefix.trim().length < LABEL_MAX;

  const labels = useMemo(
    () => (countOk && startOk && paddingOk && prefixOk ? bulkLabels(prefix.trim(), startN!, countN!, paddingN!) : []),
    [countOk, startOk, paddingOk, prefixOk, prefix, startN, countN, paddingN],
  );

  const conflicts = useMemo(() => {
    const taken = takenKeys(areas);
    for (const label of serverConflicts) taken.add(toTableKey(label));
    const seen = new Set<string>();
    const result = new Set<string>();
    for (const label of labels) {
      const key = toTableKey(label);
      if (taken.has(key) || seen.has(key)) result.add(label);
      seen.add(key);
    }
    return result;
  }, [areas, labels, serverConflicts]);

  const tooLong = labels.find((l) => l.length > LABEL_MAX);
  const valid = !!area && labels.length > 0 && conflicts.size === 0 && !tooLong && seatsOk && colsOk;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || !area) return;
    setError(null);
    try {
      await onSubmit({
        areaId: area.id,
        prefix: prefix.trim(),
        start: startN!,
        count: countN!,
        padding: paddingN!,
        shape,
        ...(seatsN ? { seats: seatsN } : {}),
        layout: { cols: colsN!, gap: Math.max(area.gridSize, 20) * 2 },
      });
    } catch (err) {
      if (err instanceof ApiException && err.reason === 'TABLE_LABEL_TAKEN') {
        const fromDetails = (err.details ?? []).filter((d) => d.field === 'label').map((d) => d.message);
        const fromParams = String(err.params?.conflicts ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        setServerConflicts(fromDetails.length ? fromDetails : fromParams);
      }
      setError(apiErrorMessage(err));
    }
  };

  const preview = labels.slice(0, PREVIEW_MAX);
  const conflictList = [...conflicts];

  return (
    <TablesModal
      title={t('title')}
      size="lg"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!valid} loading={pending}>
            {t('submit', { count: labels.length })}
          </Button>
        </>
      }
    >
      <div className="tables-grid-2">
        <Select label={t('area')} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Input
          label={t('prefix')}
          hint={t('prefixHint')}
          value={prefix}
          maxLength={LABEL_MAX - 1}
          onChange={(e) => {
            setPrefix(e.target.value);
            setServerConflicts([]);
          }}
          autoComplete="off"
        />
      </div>
      <div className="tables-grid-3">
        <Input
          label={t('start')}
          type="number"
          inputMode="numeric"
          min={0}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          error={startOk ? undefined : t('startInvalid')}
        />
        <Input
          label={t('count')}
          type="number"
          inputMode="numeric"
          min={1}
          max={BULK_MAX}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          error={countOk ? undefined : t('countInvalid', { max: BULK_MAX })}
        />
        <Input
          label={t('padding')}
          hint={t('paddingHint')}
          type="number"
          inputMode="numeric"
          min={0}
          max={3}
          value={padding}
          onChange={(e) => setPadding(e.target.value)}
          error={paddingOk ? undefined : t('paddingInvalid')}
        />
      </div>
      <div className="tables-grid-3">
        <Input
          label={t('seats')}
          type="number"
          inputMode="numeric"
          min={1}
          max={SEATS_MAX}
          placeholder={t('seatsPlaceholder')}
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          error={seatsOk ? undefined : t('seatsInvalid', { max: SEATS_MAX })}
        />
        <Input
          label={t('cols')}
          hint={t('colsHint')}
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          value={cols}
          onChange={(e) => setCols(e.target.value)}
          error={colsOk ? undefined : t('colsInvalid')}
        />
        <div className="oe-field">
          <span className="tables-inspector__label" aria-hidden="true">
            {t('shape')}
          </span>
          <Segment<DiningTableShape>
            aria-label={t('shape')}
            value={shape}
            onChange={setShape}
            options={[
              { id: 'rect', label: tShape('rect'), icon: 'table' },
              { id: 'round', label: tShape('round'), icon: 'table-round' },
            ]}
          />
        </div>
      </div>

      <section className="tables-bulk__preview" aria-labelledby="tables-bulk-preview">
        <div className="tables-bulk__preview-head">
          <h3 id="tables-bulk-preview">{t('preview')}</h3>
          <span className="tables-mono">{t('previewCount', { count: labels.length })}</span>
        </div>
        {preview.length > 0 ? (
          <ul className="oe-tables tables-bulk__chips" aria-label={t('preview')}>
            {preview.map((label, i) => {
              const conflict = conflicts.has(label);
              return (
                <li
                  key={`${label}-${i}`}
                  className={conflict ? 'oe-tablechip oe-tablechip--wait' : 'oe-tablechip'}
                  aria-label={conflict ? t('takenLabel', { label }) : undefined}
                >
                  {label}
                  {conflict && <small aria-hidden="true">{t('taken')}</small>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="tables-muted">{t('previewEmpty')}</p>
        )}
        {labels.length > PREVIEW_MAX && (
          <p className="tables-muted">{t('more', { count: labels.length - PREVIEW_MAX })}</p>
        )}
        <div aria-live="polite">
          {conflictList.length > 0 && (
            <p className="tables-error">
              {t('conflicts', { count: conflictList.length, labels: conflictList.slice(0, 12).join(', ') })}
            </p>
          )}
          {tooLong && <p className="tables-error">{t('tooLong', { label: tooLong, max: LABEL_MAX })}</p>}
        </div>
      </section>

      {error && (
        <p className="tables-error" role="alert">
          {error}
        </p>
      )}
    </TablesModal>
  );
}
