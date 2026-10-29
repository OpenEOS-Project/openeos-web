'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { useTranslations } from 'next-intl';

import '@/styles/assistant.css';
import { parsePosIcon } from '@/utils/product-icon';
import { Banner, Button, Checkbox, Chip, Icon, Segment, Spinner, StatusDot } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { PosIconImage } from '@/components/shared/pos-icon-image';
import { PosIconPicker } from '@/components/shared/pos-icon-picker';
import { toast } from '@/components/shared/toast';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useAssistantStatus } from '@/hooks/use-assistant';
import { useCategories } from '@/hooks/use-categories';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import {
  useApplyMenuImport,
  useCreateMenuImport,
  useDeleteMenuImport,
  useMenuImport,
} from '@/hooks/use-menu-import';
import { useOrganization } from '@/hooks/use-organizations';
import { usePfandTypes } from '@/hooks/use-pfand-types';

import { quotaLine } from '@/lib/assistant';
import {
  EMPTY_MENU_SUGGESTION,
  MENU_IMPORT_MAX_FILES,
  MENU_IMPORT_MAX_MB,
  MENU_IMPORT_MAX_TEXT,
  type PreviewRow,
  type PreviewState,
  buildApplyPayload,
  buildPreview,
  checkMenuFiles,
  menuImportAccept,
  menuImportPending,
} from '@/lib/menu-import';
import { taxRatesFor } from '@/lib/tax-rates';

import { useAuthStore } from '@/stores/auth-store';

import type { MenuTaxRate } from '@/types/assistant';

interface MenuImportDialogProps {
  isOpen: boolean;
  eventId: string;
  onClose: () => void;
}

type Source = 'files' | 'text';

/** „currywurst-pommes“ → „Currywurst pommes“ — für Tooltips der Icon-Vorschläge. */
function iconLabel(icon: string): string {
  const id = parsePosIcon(icon) ?? icon;
  const text = id.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Aus Speisekarte importieren (ki-plan.md 6.6): Fotos/PDF oder Text
 * hochladen → die API wertet im Hintergrund aus (Polling + Socket) →
 * Vorschau-Tabelle zum Durchsehen und Anpassen → „N Produkte anlegen“.
 *
 * Nichts wird ohne Durchsicht gespeichert: der Vorschlag ist Vorschlag,
 * erst `apply` legt Kategorien und Produkte an.
 *
 * PDF gibt es nur, wenn der Anbieter auf dem Server sie liest
 * (`pdfSupported` im Assistent-Status); sonst bietet die Dateiauswahl nur
 * Fotos an. Eine Karte ohne erkennbare Produkte kommt als `done` ohne
 * Produkte zurück und zeigt statt der Tabelle einen Hinweis mit dem Weg
 * zurück zur Eingabe. `error` bei `failed` ist für Menschen formuliert und
 * wird unverändert angezeigt.
 */
export function MenuImportDialog({ isOpen, eventId, onClose }: MenuImportDialogProps) {
  const t = useTranslations('products.menuImport');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatCurrency } = useLocaleFormat();
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId ?? '';

  const { data: organization } = useOrganization(organizationId);
  const taxRates = taxRatesFor(
    organization?.settings?.address?.country,
    organization?.settings?.vatExempt
  );
  const { data: pfandTypes } = usePfandTypes(organizationId || undefined);
  const { data: categories, isLoading: categoriesLoading } = useCategories(eventId);
  const status = useAssistantStatus(organizationId || undefined);
  // Ältere API-Stände kennen das Feld nicht — dann wie bisher PDF anbieten.
  const pdfSupported = status.data?.pdfSupported !== false;

  const [source, setSource] = useState<Source>('files');
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [iconPickerRow, setIconPickerRow] = useState<string | null>(null);

  const createImport = useCreateMenuImport(organizationId, eventId);
  const applyImport = useApplyMenuImport(organizationId, eventId);
  const deleteImport = useDeleteMenuImport(organizationId, eventId);
  const menuImport = useMenuImport(organizationId, eventId, importId);
  const { mutate: discardImport } = deleteImport;

  const importData = menuImport.data;
  const pending = !!importId && (!importData || menuImportPending(importData.status));

  // Vorschlag angekommen: Tabelle einmal aufbauen (Pfand-Typen und
  // Kategorien der Veranstaltung fließen in die Vorbelegung ein). Ohne
  // Produkte bleibt die Tabelle leer und der Dialog zeigt den Hinweis.
  useEffect(() => {
    if (!importId || preview || categoriesLoading) return;
    if (importData?.status === 'done') {
      setPreview(
        buildPreview(importData.suggestion ?? EMPTY_MENU_SUGGESTION, {
          pfandTypes: pfandTypes ?? [],
          existingCategories: categories ?? [],
        })
      );
    }
  }, [importId, importData, preview, categoriesLoading, pfandTypes, categories]);

  const reset = useCallback(() => {
    setSource('files');
    setFiles([]);
    setText('');
    setInputError(null);
    setImportId(null);
    setPreview(null);
    setIconPickerRow(null);
    setDragOver(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    setInputError(null);
    setFiles((current) => {
      const next = [...current];
      for (const file of Array.from(incoming)) {
        if (!next.some((known) => known.name === file.name && known.size === file.size))
          next.push(file);
      }
      return next;
    });
  };

  const start = () => {
    setInputError(null);
    if (source === 'files') {
      const check = checkMenuFiles(files, { pdfSupported });
      if (!check.ok) {
        // Ohne PDF-Unterstützung nennt die Fehlermeldung auch keine PDF.
        const problem = check.problem === 'type' && !pdfSupported ? 'typeImages' : check.problem;
        setInputError(
          t(`fileProblems.${problem}`, { ...check.params, name: check.params.name ?? '' })
        );
        return;
      }
    } else if (!text.trim()) {
      setInputError(t('fileProblems.empty'));
      return;
    }
    createImport.mutate(source === 'files' ? { files } : { text: text.trim() }, {
      onSuccess: (data) => setImportId(data.id),
      onError: (err) => setInputError(apiErrorMessage(err, tCommon('error'))),
    });
  };

  /** Zurück zur Eingabe; Dateien und Text bleiben für den nächsten Versuch. */
  const retry = () => {
    if (importId) discardImport(importId);
    setImportId(null);
    setPreview(null);
    setInputError(null);
  };

  /** Zurück zur Eingabe, gleich auf den Text-Reiter — wenn Fotos nichts ergaben. */
  const retryAsText = () => {
    retry();
    setSource('text');
  };

  const updateRow = (key: string, patch: Partial<PreviewRow>) => {
    setPreview((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
          }
        : current
    );
  };

  const build = useMemo(() => (preview ? buildApplyPayload(preview) : null), [preview]);
  const problemCount = build ? Object.keys(build.problems).length : 0;
  const selectedCount = preview ? preview.rows.filter((row) => row.selected).length : 0;
  const allSelected = !!preview && preview.rows.length > 0 && selectedCount === preview.rows.length;
  const previewEmpty = !!preview && preview.rows.length === 0;

  const apply = () => {
    if (!importId || !build || problemCount > 0 || build.data.products.length === 0) return;
    applyImport.mutate(
      { id: importId, data: build.data },
      {
        onSuccess: (result) => {
          toast.success(
            t('applied', {
              created: result.createdProducts,
              updated: result.updatedProducts,
              categories: result.createdCategories,
            })
          );
          handleClose();
        },
        onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
      }
    );
  };

  const quota = quotaLine(status.data?.quotas.menuImports);
  const quotaExhausted = quota.kind === 'exhausted';

  if (!isOpen) return null;

  const step: 'input' | 'progress' | 'failed' | 'preview' = !importId
    ? 'input'
    : pending
      ? 'progress'
      : importData?.status === 'failed'
        ? 'failed'
        : 'preview';

  const quotaText =
    quota.kind === 'exhausted'
      ? t('quota.exhausted')
      : quota.kind === 'remaining'
        ? t('quota.remaining', { remaining: quota.remaining })
        : '';

  const pickerRow = preview?.rows.find((row) => row.key === iconPickerRow) ?? null;

  const renderInput = () => (
    <>
      <Segment
        aria-label={t('title')}
        options={[
          { id: 'files', label: pdfSupported ? t('source.files') : t('source.images') },
          { id: 'text', label: t('source.text') },
        ]}
        value={source}
        onChange={(id) => {
          setSource(id);
          setInputError(null);
        }}
      />

      {source === 'files' ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={menuImportAccept(pdfSupported)}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <div
            role="button"
            tabIndex={0}
            className={dragOver ? 'menu-import__drop is-over' : 'menu-import__drop'}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <Icon name="download" size={28} />
            <p className="menu-import__drop-title">
              {pdfSupported ? t('drop.title') : t('drop.titleImages')}
            </p>
            <p className="menu-import__drop-hint">
              {t(pdfSupported ? 'drop.hint' : 'drop.hintImages', {
                max: MENU_IMPORT_MAX_FILES,
                maxMb: MENU_IMPORT_MAX_MB,
              })}
            </p>
            <span className="btn btn--ghost" style={{ fontSize: 12 }}>
              {t('drop.choose')}
            </span>
          </div>
          {files.length > 0 && (
            <div
              className="menu-import__files"
              aria-label={t('drop.count', { count: files.length })}
            >
              {files.map((file) => (
                <Chip
                  key={`${file.name}-${file.size}`}
                  removeLabel={t('drop.remove', { name: file.name })}
                  onRemove={() => setFiles((current) => current.filter((known) => known !== file))}
                >
                  {file.name}
                </Chip>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="auth-field">
          <span className="auth-field__label">{t('text.label')}</span>
          <textarea
            className="textarea menu-import__textarea"
            value={text}
            maxLength={MENU_IMPORT_MAX_TEXT}
            placeholder={t('text.placeholder')}
            onChange={(e) => {
              setText(e.target.value);
              setInputError(null);
            }}
          />
          <p className="menu-import__count">
            {t('text.count', { count: text.length, max: MENU_IMPORT_MAX_TEXT })}
          </p>
        </div>
      )}

      {inputError && (
        <Banner tone="danger" icon={<Icon name="alert" />}>
          {inputError}
        </Banner>
      )}
    </>
  );

  const renderProgress = () => (
    <div className="menu-import__progress" role="status" aria-live="polite">
      <Spinner />
      <h3>{t('progress.title')}</h3>
      <p>{importData?.status === 'processing' ? t('progress.processing') : t('progress.queued')}</p>
      <Button variant="ghost" size="sm" onClick={retry} disabled={deleteImport.isPending}>
        {t('progress.cancel')}
      </Button>
    </div>
  );

  const renderFailed = () => (
    <Banner tone="danger" icon={<Icon name="alert" />} title={t('failed.title')}>
      {importData?.error || t('failed.unknown')}
    </Banner>
  );

  const renderRow = (row: PreviewRow) => {
    const problem = build?.problems[row.key];
    const iconId = row.icon ? parsePosIcon(row.icon) : null;
    const category = preview!.categories.find((c) => c.key === row.categoryKey);
    return (
      <tr key={row.key} style={row.selected ? undefined : { opacity: 0.55 }}>
        <td>
          <Checkbox
            checked={row.selected}
            aria-label={t('table.selectRow', { name: row.name || row.key })}
            onChange={(e) => updateRow(row.key, { selected: e.target.checked })}
          />
        </td>
        <td>
          <div className="menu-import__name">
            <input
              className="input"
              value={row.name}
              aria-label={t('table.name')}
              onChange={(e) => updateRow(row.key, { name: e.target.value })}
            />
            {(row.existingProductId ||
              row.confidence !== 'high' ||
              (category && !category.existingCategoryId)) && (
              <div className="menu-import__meta">
                {row.confidence !== 'high' && (
                  <span
                    className="menu-import__confidence"
                    title={t(`preview.confidence.${row.confidence}`)}
                    aria-label={t(`preview.confidence.${row.confidence}`)}
                  >
                    <StatusDot tone={row.confidence === 'low' ? 'danger' : 'warn'} />
                  </span>
                )}
                {row.existingProductId && (
                  <>
                    <span className="badge badge--neutral">{t('preview.existing')}</span>
                    <select
                      className="select"
                      style={{
                        width: 'auto',
                        minHeight: 24,
                        padding: '2px 26px 2px 6px',
                        fontSize: 11,
                      }}
                      value={row.action}
                      aria-label={t('preview.existing')}
                      onChange={(e) =>
                        updateRow(row.key, { action: e.target.value as PreviewRow['action'] })
                      }
                    >
                      <option value="update">{t('action.update')}</option>
                      <option value="create">{t('action.create')}</option>
                    </select>
                  </>
                )}
              </div>
            )}
            {row.note && <p className="menu-import__note">{row.note}</p>}
            {problem && <p className="menu-import__problem">{t(`problems.${problem}`)}</p>}
          </div>
        </td>
        <td>
          <select
            className="select menu-import__select"
            value={row.categoryKey}
            aria-label={t('table.category')}
            onChange={(e) => updateRow(row.key, { categoryKey: e.target.value })}
          >
            {preview!.categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.existingCategoryId ? c.name : `${c.name} · ${t('preview.newCategory')}`}
              </option>
            ))}
          </select>
        </td>
        <td className="text-right">
          <input
            className="input menu-import__price"
            inputMode="decimal"
            value={row.price}
            aria-label={t('table.price')}
            onChange={(e) => updateRow(row.key, { price: e.target.value })}
          />
        </td>
        <td>
          <select
            className="select"
            style={{ width: 'auto' }}
            value={row.taxRate}
            aria-label={t('table.taxRate')}
            disabled={taxRates.length === 1}
            onChange={(e) => updateRow(row.key, { taxRate: Number(e.target.value) as MenuTaxRate })}
          >
            {taxRates.map((option) => (
              <option key={option.rate} value={option.rate}>
                {option.rate} %
              </option>
            ))}
            {!taxRates.some((option) => option.rate === row.taxRate) && (
              <option value={row.taxRate}>{row.taxRate} %</option>
            )}
          </select>
        </td>
        <td>
          {(pfandTypes?.length ?? 0) > 0 ? (
            <select
              className="select menu-import__select"
              value={row.pfandTypeId}
              aria-label={t('table.pfand')}
              onChange={(e) => updateRow(row.key, { pfandTypeId: e.target.value })}
            >
              <option value="">{t('pfand.none')}</option>
              {pfandTypes!.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({formatCurrency(type.amount)})
                </option>
              ))}
            </select>
          ) : (
            <span className="menu-import__meta">
              {row.pfandSuggested ? t('pfand.noTypes') : '—'}
            </span>
          )}
          {row.pfandSuggested && (
            <p className="menu-import__note">
              {row.pfandAmount !== undefined
                ? t('pfand.suggestedAmount', { amount: formatCurrency(row.pfandAmount) })
                : t('pfand.suggested')}
            </p>
          )}
        </td>
        <td>
          <div className="menu-import__variants">
            {row.variants.map((variant, index) => (
              <div key={index} className="menu-import__variant">
                <input
                  className="input"
                  value={variant.name}
                  placeholder={t('variants.name')}
                  aria-label={t('variants.name')}
                  onChange={(e) =>
                    updateRow(row.key, {
                      variants: row.variants.map((v, i) =>
                        i === index ? { ...v, name: e.target.value } : v
                      ),
                    })
                  }
                />
                <input
                  className="input input--modifier"
                  inputMode="decimal"
                  value={variant.priceModifier}
                  placeholder="0.00"
                  aria-label={t('variants.modifier')}
                  onChange={(e) =>
                    updateRow(row.key, {
                      variants: row.variants.map((v, i) =>
                        i === index ? { ...v, priceModifier: e.target.value } : v
                      ),
                    })
                  }
                />
                <Button
                  variant="quiet"
                  size="sm"
                  iconOnly
                  aria-label={t('variants.remove')}
                  title={t('variants.remove')}
                  onClick={() =>
                    updateRow(row.key, { variants: row.variants.filter((_, i) => i !== index) })
                  }
                >
                  <Icon name="x" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                updateRow(row.key, {
                  variants: [...row.variants, { name: '', priceModifier: '0.00' }],
                })
              }
            >
              <Icon name="plus" />
              {t('variants.add')}
            </Button>
          </div>
        </td>
        <td>
          <div className="menu-import__icon">
            <button
              type="button"
              className={iconId ? 'menu-import__icon-btn is-selected' : 'menu-import__icon-btn'}
              title={t('icon.choose')}
              aria-label={iconId ? `${t('icon.choose')} (${iconLabel(iconId)})` : t('icon.choose')}
              onClick={() => setIconPickerRow(row.key)}
            >
              {iconId ? <PosIconImage id={iconId} /> : <Icon name="grid" />}
            </button>
            {row.iconSuggestions.length > 0 && (
              <span className="menu-import__icon-sep" aria-hidden="true" />
            )}
            {row.iconSuggestions.slice(0, 3).map((suggestion) => {
              const id = parsePosIcon(suggestion.icon);
              if (!id) return null;
              const active = suggestion.icon === row.icon;
              return (
                <button
                  key={suggestion.icon}
                  type="button"
                  className={active ? 'menu-import__icon-btn is-selected' : 'menu-import__icon-btn'}
                  title={t('icon.suggestion', { label: iconLabel(id) })}
                  aria-label={t('icon.suggestion', { label: iconLabel(id) })}
                  aria-pressed={active}
                  onClick={() => updateRow(row.key, { icon: active ? null : suggestion.icon })}
                >
                  <PosIconImage id={id} />
                </button>
              );
            })}
          </div>
        </td>
      </tr>
    );
  };

  const renderPreview = () => {
    if (!preview) {
      return (
        <div className="menu-import__progress">
          <Spinner />
        </div>
      );
    }
    const warnings = importData?.suggestion?.warnings ?? [];
    return (
      <>
        {preview.rows.length > 0 && (
          <p className="menu-import__caution">
            <Icon name="info" />
            {t('preview.caution')}
          </p>
        )}
        {warnings.length > 0 && (
          /* Kein Banner: der packt seinen Inhalt in ein <p>, und eine Liste
             darf dort nicht hinein. */
          <div className="menu-import__warnings" role="status">
            <Icon name="alert" />
            <div>
              <b>{t('preview.warnings')}</b>
              <ul>
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {preview.rows.length === 0 ? (
          <Banner tone="info" icon={<Icon name="info" />} title={t('preview.emptyTitle')}>
            {t('preview.empty')} {t('preview.emptyHint')}
          </Banner>
        ) : (
          <>
            <div className="menu-import__toolbar">
              <span>
                {t('preview.selected', { count: selectedCount, total: preview.rows.length })}
              </span>
            </div>
            <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="data-table data-table--compact menu-import__table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <Checkbox
                        checked={allSelected}
                        aria-label={t('table.selectAll')}
                        onChange={(e) =>
                          setPreview({
                            ...preview,
                            rows: preview.rows.map((row) => ({
                              ...row,
                              selected: e.target.checked,
                            })),
                          })
                        }
                      />
                    </th>
                    <th>{t('table.name')}</th>
                    <th>{t('table.category')}</th>
                    <th className="text-right">{t('table.price')}</th>
                    <th>{t('table.taxRate')}</th>
                    <th>{t('table.pfand')}</th>
                    <th>{t('table.variants')}</th>
                    <th>{t('table.icon')}</th>
                  </tr>
                </thead>
                <tbody>{preview.rows.map(renderRow)}</tbody>
              </table>
            </div>
          </>
        )}
      </>
    );
  };

  const applyLabel = build
    ? build.counts.update > 0
      ? t('applyMixed', { create: build.counts.create, update: build.counts.update })
      : t('apply', { count: build.counts.create })
    : t('apply', { count: 0 });

  return (
    <>
      <div className="modal__overlay" onClick={handleClose}>
        <ModalPanel
          titleId={titleId}
          className={
            step === 'preview'
              ? 'menu-import__panel menu-import__panel--wide'
              : 'menu-import__panel'
          }
        >
          <div className="modal__head">
            <h2 id={titleId}>{t('title')}</h2>
            <DialogCloseButton onClick={handleClose} />
          </div>

          <div className="modal__body menu-import__body">
            {step === 'input' && renderInput()}
            {step === 'progress' && renderProgress()}
            {step === 'failed' && renderFailed()}
            {step === 'preview' && renderPreview()}
          </div>

          <div className="modal__foot">
            {quotaText && <span className="menu-import__quota">{quotaText}</span>}
            <button type="button" className="btn btn--ghost" onClick={handleClose}>
              {tCommon('cancel')}
            </button>
            {step === 'input' && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={start}
                disabled={createImport.isPending || quotaExhausted}
              >
                {createImport.isPending ? tCommon('loading') : t('start')}
              </button>
            )}
            {step === 'failed' && (
              <button type="button" className="btn btn--primary" onClick={retry}>
                {t('failed.retry')}
              </button>
            )}
            {step === 'preview' && previewEmpty && (
              <>
                <button type="button" className="btn btn--ghost" onClick={retryAsText}>
                  {t('preview.useText')}
                </button>
                <button type="button" className="btn btn--primary" onClick={retry}>
                  {t('preview.retry')}
                </button>
              </>
            )}
            {step === 'preview' && !previewEmpty && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={apply}
                disabled={
                  !build ||
                  build.data.products.length === 0 ||
                  problemCount > 0 ||
                  applyImport.isPending
                }
              >
                {applyImport.isPending ? tCommon('saving') : applyLabel}
              </button>
            )}
          </div>
        </ModalPanel>
      </div>

      <PosIconPicker
        isOpen={!!pickerRow}
        value={pickerRow?.icon ?? null}
        onClose={() => setIconPickerRow(null)}
        onSelect={(value) => {
          if (iconPickerRow) updateRow(iconPickerRow, { icon: value });
        }}
      />
    </>
  );
}
