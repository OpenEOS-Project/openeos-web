'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { WIDGET_REGISTRY } from './widgets/index';
import type { WidgetDefinition } from './widgets/widget-registry';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';

interface CustomizeModalProps {
  enabledIds: string[];
  availableWidgets: WidgetDefinition[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
  isSaving: boolean;
}

export function CustomizeModal({ enabledIds, availableWidgets, onSave, onClose, isSaving }: CustomizeModalProps) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  // Local state: ordered list of enabled widget ids (only from availableWidgets)
  const [ordered, setOrdered] = useState<string[]>(() => {
    // Keep saved order, adding any newly available widgets at end
    const availableIds = new Set(availableWidgets.map((w) => w.id));
    const filtered = enabledIds.filter((id) => availableIds.has(id));
    return filtered;
  });

  const availableMap = new Map(availableWidgets.map((w) => [w.id, w]));

  function isEnabled(id: string): boolean {
    return ordered.includes(id);
  }

  function toggle(id: string) {
    setOrdered((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function moveUp(id: string) {
    setOrdered((prev) => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(id: string) {
    setOrdered((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  // Display: first show enabled (in order), then disabled
  const enabledItems = ordered.map((id) => availableMap.get(id)!).filter(Boolean);
  const disabledItems = availableWidgets.filter((w) => !ordered.includes(w.id));

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box modal__panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('customize.title')}</div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginBottom: 16 }}>
            {t('customize.description')}
          </p>

          {/* Enabled widgets (orderable) */}
          {enabledItems.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'color-mix(in oklab, var(--ink) 40%, transparent)', marginBottom: 8 }}>
                {t('customize.enabled')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {enabledItems.map((widget, idx) => (
                  <div
                    key={widget.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'color-mix(in oklab, var(--green-soft) 30%, var(--paper))',
                      border: '1px solid color-mix(in oklab, var(--green-ink) 20%, transparent)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggle(widget.id)}
                      style={{ accentColor: 'var(--green-ink)', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t(widget.labelKey as Parameters<typeof t>[0])}</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveUp(widget.id)}
                        style={{
                          width: 28, height: 28, borderRadius: 6, border: 'none', cursor: idx === 0 ? 'default' : 'pointer',
                          background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: idx === 0 ? 'color-mix(in oklab, var(--ink) 20%, transparent)' : 'var(--ink)',
                        }}
                        aria-label={t('customize.moveUp')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6" /></svg>
                      </button>
                      <button
                        type="button"
                        disabled={idx === enabledItems.length - 1}
                        onClick={() => moveDown(widget.id)}
                        style={{
                          width: 28, height: 28, borderRadius: 6, border: 'none', cursor: idx === enabledItems.length - 1 ? 'default' : 'pointer',
                          background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: idx === enabledItems.length - 1 ? 'color-mix(in oklab, var(--ink) 20%, transparent)' : 'var(--ink)',
                        }}
                        aria-label={t('customize.moveDown')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disabled widgets */}
          {disabledItems.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'color-mix(in oklab, var(--ink) 40%, transparent)', marginBottom: 8 }}>
                {t('customize.disabled')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {disabledItems.map((widget) => (
                  <div
                    key={widget.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'none',
                      border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => toggle(widget.id)}
                      style={{ accentColor: 'var(--green-ink)', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 400, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>
                      {t(widget.labelKey as Parameters<typeof t>[0])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose} disabled={isSaving}>
            {t('customize.cancel')}
          </button>
          <button
            className="btn btn--primary"
            onClick={() => onSave(ordered)}
            disabled={isSaving}
          >
            {isSaving ? tCommon('saving') : t('customize.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
