'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { productsApi } from '@/lib/api-client';
import { productKeys } from '@/hooks/use-products';
import { categoryKeys } from '@/hooks/use-categories';
import { formatCurrency } from '@/utils/format';
import type { ProductImportResult, ProductImportRow } from '@/types/product';

interface ProductImportModalProps {
  isOpen: boolean;
  eventId: string;
  onClose: () => void;
}

const TEMPLATE_BOM = '﻿';
const TEMPLATE_HEADER = 'category,name,description,price,pfand,icon,ingredients,choices,extras,available';
const TEMPLATE_ROWS = [
  'Essen,Pommes Frites,,3.00,,pommes,,Sauce: Ketchup | Mayonnaise,,',
  'Getränke,Cola 0.33 L,,2.80,2.00,cola,,Sorte: Normal | Zero,,',
];
const TEMPLATE_CSV = TEMPLATE_BOM + TEMPLATE_HEADER + '\r\n' + TEMPLATE_ROWS.join('\r\n') + '\r\n';

type ImportMode = 'skip' | 'update' | 'create';

function actionBadgeStyle(action: ProductImportRow['action']): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
  switch (action) {
    case 'create':
      return { ...base, background: 'color-mix(in oklab, #22c55e 15%, transparent)', color: '#16a34a' };
    case 'update':
      return { ...base, background: 'color-mix(in oklab, #3b82f6 15%, transparent)', color: '#2563eb' };
    case 'skip':
      return { ...base, background: 'color-mix(in oklab, var(--ink) 10%, transparent)', color: 'var(--ink)', opacity: 0.7 };
    case 'error':
      return { ...base, background: 'color-mix(in oklab, var(--danger) 15%, transparent)', color: 'var(--danger)' };
  }
}

export function ProductImportModal({ isOpen, eventId, onClose }: ProductImportModalProps) {
  const t = useTranslations('products.import');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvText, setCsvText] = useState('');
  const [mode, setMode] = useState<ImportMode>('skip');
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ProductImportResult | null>(null);
  const [importDone, setImportDone] = useState(false);
  const [importSummary, setImportSummary] = useState<ProductImportResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      // Strip BOM if present
      setCsvText(text.startsWith('﻿') ? text.slice(1) : text);
      setPreviewResult(null);
      setImportDone(false);
    } catch {
      // Ignore read errors
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePreview = async () => {
    if (!csvText.trim()) return;
    setIsLoading(true);
    setPreviewResult(null);
    try {
      const res = await productsApi.import(eventId, { csv: csvText, mode, dryRun: true });
      setPreviewResult(res.data);
    } catch {
      // API errors surface via fatalError in normal response; network errors silently ignored
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setIsLoading(true);
    try {
      const res = await productsApi.import(eventId, { csv: csvText, mode, dryRun: false });
      setImportSummary(res.data);
      setImportDone(true);
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produkt-vorlage.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setCsvText('');
    setMode('skip');
    setPreviewResult(null);
    setImportDone(false);
    setImportSummary(null);
    onClose();
  };

  const canImport =
    !importDone &&
    previewResult !== null &&
    !previewResult.fatalError &&
    (previewResult.summary.create + previewResult.summary.update) > 0;

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ink)',
    opacity: 0.7,
    marginBottom: 6,
    display: 'block',
  };

  const chipStyle = (color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    background: `color-mix(in oklab, ${color} 15%, transparent)`,
    color,
  });

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" onClick={handleClose}>
      <div className="modal__panel" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{t('title')}</h2>
          <button type="button" className="modal__close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal__body" style={{ maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Success state */}
          {importDone && importSummary && (
            <div style={{ background: 'color-mix(in oklab, #22c55e 12%, transparent)', border: '1px solid color-mix(in oklab, #22c55e 30%, transparent)', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontWeight: 600, color: '#16a34a', marginBottom: 6 }}>{t('success.title')}</div>
              <div style={{ fontSize: 13, color: '#16a34a' }}>
                {t('success.message', {
                  create: importSummary.summary.create,
                  update: importSummary.summary.update,
                  skip: importSummary.summary.skip,
                  error: importSummary.summary.error,
                })}
              </div>
            </div>
          )}

          {!importDone && (
            <>
              {/* File input + paste */}
              <div>
                <span style={labelStyle}>{t('csvLabel')}</span>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t('chooseFile')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: 12 }}
                    onClick={handleDownloadTemplate}
                  >
                    {t('downloadTemplate')}
                  </button>
                </div>
                <textarea
                  style={{
                    width: '100%',
                    minHeight: 100,
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    border: '1px solid color-mix(in oklab, var(--ink) 14%, transparent)',
                    background: 'var(--paper)',
                    color: 'var(--ink)',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  placeholder={t('pastePlaceholder')}
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    setPreviewResult(null);
                    setImportDone(false);
                  }}
                />
              </div>

              {/* Mode */}
              <div>
                <span style={labelStyle}>{t('modeLabel')}</span>
                <select
                  className="select"
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value as ImportMode);
                    setPreviewResult(null);
                  }}
                >
                  <option value="skip">{t('mode.skip')}</option>
                  <option value="update">{t('mode.update')}</option>
                  <option value="create">{t('mode.create')}</option>
                </select>
              </div>

              {/* Column helper */}
              <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.6, lineHeight: 1.6, background: 'color-mix(in oklab, var(--ink) 5%, transparent)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('columnHint.title')}</div>
                <div>{t('columnHint.body')}</div>
              </div>

              {/* Fatal error */}
              {previewResult?.fatalError && (
                <div style={{ background: 'color-mix(in oklab, var(--danger) 12%, transparent)', border: '1px solid color-mix(in oklab, var(--danger) 30%, transparent)', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13 }}>
                  <strong>{t('fatalError')}</strong> {previewResult.fatalError}
                </div>
              )}

              {/* Preview results */}
              {previewResult && !previewResult.fatalError && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Summary chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <span style={chipStyle('#16a34a')}>
                      +{previewResult.summary.create} {t('summary.create')}
                    </span>
                    <span style={chipStyle('#2563eb')}>
                      ~{previewResult.summary.update} {t('summary.update')}
                    </span>
                    <span style={{ ...chipStyle('var(--ink)'), opacity: 0.7 }}>
                      {previewResult.summary.skip} {t('summary.skip')}
                    </span>
                    {previewResult.summary.error > 0 && (
                      <span style={chipStyle('var(--danger)')}>
                        {previewResult.summary.error} {t('summary.error')}
                      </span>
                    )}
                  </div>

                  {/* New categories */}
                  {previewResult.newCategories.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', opacity: 0.6, marginBottom: 4 }}>{t('newCategories')}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {previewResult.newCategories.map((cat) => (
                          <span key={cat} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'color-mix(in oklab, var(--warn) 15%, transparent)', color: '#b45309' }}>
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* New pfand types */}
                  {previewResult.newPfandTypes.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', opacity: 0.6, marginBottom: 4 }}>{t('newPfandTypes')}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {previewResult.newPfandTypes.map((pt) => (
                          <span key={pt.name} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'color-mix(in oklab, var(--warn) 15%, transparent)', color: '#b45309' }}>
                            {pt.name} ({formatCurrency(pt.amount)})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rows table */}
                  <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto', border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'color-mix(in oklab, var(--ink) 5%, transparent)' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('table.line')}</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>{t('table.name')}</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>{t('table.category')}</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('table.price')}</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{t('table.pfand')}</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>{t('table.icon')}</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>{t('table.action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.rows.map((row, i) => (
                          <tr
                            key={i}
                            style={{
                              borderTop: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                              background: row.action === 'error' ? 'color-mix(in oklab, var(--danger) 5%, transparent)' : undefined,
                            }}
                          >
                            <td style={{ padding: '5px 10px', color: 'var(--ink)', opacity: 0.5 }}>{row.line}</td>
                            <td style={{ padding: '5px 10px' }}>{row.name}</td>
                            <td style={{ padding: '5px 10px', opacity: 0.7 }}>{row.category}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right' }}>{formatCurrency(row.price)}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', opacity: 0.7 }}>
                              {row.pfand != null ? formatCurrency(row.pfand) : '—'}
                            </td>
                            <td style={{ padding: '5px 10px', opacity: 0.6 }}>{row.icon ?? '—'}</td>
                            <td style={{ padding: '5px 10px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={actionBadgeStyle(row.action)}>{t(`action.${row.action}`)}</span>
                                {row.message && (
                                  <span style={{ fontSize: 11, color: 'var(--danger)' }}>{row.message}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            {importDone ? tCommon('close') : tCommon('cancel')}
          </button>
          {!importDone && (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handlePreview}
                disabled={isLoading || !csvText.trim()}
              >
                {isLoading && !previewResult ? '...' : t('previewButton')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleImport}
                disabled={!canImport || isLoading}
              >
                {isLoading && previewResult ? '...' : t('importButton')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
