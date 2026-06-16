'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Check } from '@untitledui/icons';
import { useTranslations } from 'next-intl';
import type { Product, ProductOptionGroup } from '@/types/product';

interface SelectedOption {
  group: string;
  option: string;
  priceModifier: number;
  excluded?: boolean;
}

interface ProductOptionsModalProps {
  isOpen: boolean;
  product: Product;
  onClose: () => void;
  onAdd: (selectedOptions: SelectedOption[]) => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

function buildDefaultSelections(groups: ProductOptionGroup[]): SelectedOption[] {
  const defaults: SelectedOption[] = [];

  for (const group of groups) {
    if (group.type === 'ingredients') {
      for (const option of group.options) {
        defaults.push({
          group: group.name,
          option: option.name,
          priceModifier: option.priceModifier,
        });
      }
    } else if (group.type === 'single') {
      const defaultOption = group.options.find((o) => o.default);
      if (defaultOption) {
        defaults.push({
          group: group.name,
          option: defaultOption.name,
          priceModifier: defaultOption.priceModifier,
        });
      }
    } else if (group.type === 'multiple') {
      for (const option of group.options) {
        if (option.default) {
          defaults.push({
            group: group.name,
            option: option.name,
            priceModifier: option.priceModifier,
          });
        }
      }
    }
  }

  return defaults;
}

export function ProductOptionsModal({
  isOpen,
  product,
  onClose,
  onAdd,
}: ProductOptionsModalProps) {
  const t = useTranslations('pos');
  const groups = product.options?.groups || [];

  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>(() =>
    buildDefaultSelections(groups),
  );

  // Bottom-sheet animation + drag state
  const [isClosing, setIsClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ y: number; t: number; lastY: number; lastT: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedOptions(buildDefaultSelections(groups));
      setIsClosing(false);
      setDragY(0);
      setIsDragging(false);
    }
  }, [isOpen, product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOptionToggle = (group: ProductOptionGroup, optionName: string, priceModifier: number) => {
    if (group.type === 'ingredients') {
      setSelectedOptions((prev) => {
        const existing = prev.find(
          (o) => o.group === group.name && o.option === optionName,
        );

        if (existing) {
          return prev.map((o) =>
            o.group === group.name && o.option === optionName
              ? { ...o, excluded: !o.excluded }
              : o,
          );
        }
        return [...prev, { group: group.name, option: optionName, priceModifier }];
      });
      return;
    }

    const isMultiple = group.type === 'multiple';

    setSelectedOptions((prev) => {
      const existingIndex = prev.findIndex(
        (o) => o.group === group.name && o.option === optionName,
      );

      if (existingIndex >= 0) {
        return prev.filter((_, i) => i !== existingIndex);
      }

      if (isMultiple) {
        return [...prev, { group: group.name, option: optionName, priceModifier }];
      } else {
        return [
          ...prev.filter((o) => o.group !== group.name),
          { group: group.name, option: optionName, priceModifier },
        ];
      }
    });
  };

  const isOptionSelected = (groupName: string, optionName: string) => {
    const opt = selectedOptions.find((o) => o.group === groupName && o.option === optionName);
    return opt ? !opt.excluded : false;
  };

  const isOptionExcluded = (groupName: string, optionName: string) => {
    const opt = selectedOptions.find((o) => o.group === groupName && o.option === optionName);
    return opt?.excluded === true;
  };

  const totalOptionsPrice = selectedOptions
    .filter((o) => !o.excluded && o.priceModifier > 0)
    .reduce((sum, o) => sum + o.priceModifier, 0);
  const totalPrice = Number(product.price) + totalOptionsPrice;

  const hasRequiredSelections = groups
    .filter((g) => g.required)
    .every((g) => selectedOptions.some((o) => o.group === g.name && !o.excluded));

  const handleAdd = () => {
    const finalOptions = selectedOptions.filter((o) => {
      if (o.excluded) return true;
      const group = groups.find((g) => g.name === o.group);
      if (group?.type === 'ingredients') return false;
      return true;
    });
    onAdd(finalOptions);
    setSelectedOptions([]);
  };

  const handleClose = () => {
    setIsClosing((current) => {
      if (current) return current;
      window.setTimeout(() => {
        setSelectedOptions([]);
        onClose();
      }, 220);
      return true;
    });
  };

  const handleDragPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = performance.now();
    dragRef.current = { y: e.clientY, t, lastY: e.clientY, lastT: t };
    setIsDragging(true);
  };

  const handleDragPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dy = Math.max(0, e.clientY - dragRef.current.y);
    setDragY(dy);
    dragRef.current.lastY = e.clientY;
    dragRef.current.lastT = performance.now();
  };

  const handleDragPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const start = dragRef.current;
    const dy = Math.max(0, start.lastY - start.y);
    const dt = Math.max(1, start.lastT - start.t);
    const velocity = dy / dt;
    dragRef.current = null;
    setIsDragging(false);
    if (dy > 120 || velocity > 0.6) {
      handleClose();
    } else {
      setDragY(0);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore — capture may have already been released
    }
  };

  const getGroupHint = (type: ProductOptionGroup['type']) => {
    switch (type) {
      case 'single':
        return t('productOptions.singleHint');
      case 'multiple':
        return t('productOptions.multipleHint');
      case 'ingredients':
        return t('productOptions.ingredientsHint');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'transparent' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(20,18,12,.45)',
          opacity: isClosing ? 0 : 1,
          transition: 'opacity .22s ease',
        }}
      />
      <div
        className="pos-sheet"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '85%',
          background: 'var(--pos-surface)',
          borderTopLeftRadius: 'var(--pos-r-lg)',
          borderTopRightRadius: 'var(--pos-r-lg)',
          boxShadow: 'var(--pos-sh-3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isClosing
            ? 'translateY(100%)'
            : dragY > 0
              ? `translateY(${dragY}px)`
              : undefined,
          transition: isDragging ? 'none' : 'transform .22s ease',
          animation: isClosing || dragY > 0 ? undefined : 'pos-slide-up-sheet .22s ease',
          willChange: 'transform',
        }}
      >
        {/* Drag handle (large hit area for easy grabbing) */}
        <div
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          onPointerCancel={handleDragPointerUp}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 36,
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <div style={{ width: 48, height: 5, background: 'var(--pos-line-strong)', borderRadius: 999 }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px 14px',
            borderBottom: '1px solid var(--pos-line)',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--pos-ink)',
                letterSpacing: '-0.01em',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {product.name}
            </h2>
            <p
              className="pos-mono"
              style={{ fontSize: 13, color: 'var(--pos-ink-3)', marginTop: 2 }}
            >
              {formatPrice(product.price)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('productOptions.close')}
            style={{
              padding: 8,
              borderRadius: 'var(--pos-r-sm)',
              background: 'transparent',
              border: 'none',
              color: 'var(--pos-ink-2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Options scroll area */}
        <div
          className="pos-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', minHeight: 0 }}
        >
          {groups.map((group) => (
            <div key={group.name} style={{ marginBottom: 22 }}>
              <div style={{ marginBottom: 10 }}>
                <h3
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--pos-ink)',
                    margin: 0,
                    letterSpacing: '0.01em',
                  }}
                >
                  {group.name}
                  {group.required && (
                    <span style={{ marginLeft: 4, color: 'var(--pos-danger)' }}>*</span>
                  )}
                </h3>
                <p style={{ fontSize: 11, color: 'var(--pos-ink-3)', margin: '2px 0 0' }}>
                  {getGroupHint(group.type)}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.options.map((option) => {
                  const selected = isOptionSelected(group.name, option.name);
                  const excluded = isOptionExcluded(group.name, option.name);

                  if (group.type === 'ingredients') {
                    const accentColor = excluded ? 'var(--pos-danger)' : 'var(--pos-ok)';
                    return (
                      <button
                        key={option.name}
                        type="button"
                        onClick={() =>
                          handleOptionToggle(group, option.name, option.priceModifier)
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '11px 14px',
                          background: 'var(--pos-surface)',
                          border: `1px solid ${accentColor}`,
                          borderRadius: 'var(--pos-r-sm)',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                          opacity: excluded ? 0.7 : 1,
                          transition: 'border-color .12s, opacity .12s',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 'var(--pos-r-xs)',
                              background: accentColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {excluded ? (
                              <X style={{ width: 12, height: 12, color: '#fff' }} />
                            ) : (
                              <Check style={{ width: 12, height: 12, color: '#fff' }} />
                            )}
                          </span>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: excluded ? 'var(--pos-ink-3)' : 'var(--pos-ink)',
                              textDecoration: excluded ? 'line-through' : 'none',
                            }}
                          >
                            {option.name}
                          </span>
                        </span>
                        {option.priceModifier > 0 && !excluded && (
                          <span
                            className="pos-mono"
                            style={{ fontSize: 13, color: 'var(--pos-ink-3)' }}
                          >
                            +{formatPrice(option.priceModifier)}
                          </span>
                        )}
                      </button>
                    );
                  }

                  const isMultiple = group.type === 'multiple';
                  return (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() =>
                        handleOptionToggle(group, option.name, option.priceModifier)
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '11px 14px',
                        background: selected ? 'var(--pos-accent-soft)' : 'var(--pos-surface)',
                        border: `1px solid ${selected ? 'var(--pos-accent)' : 'var(--pos-line)'}`,
                        borderRadius: 'var(--pos-r-sm)',
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'left',
                        transition: 'background .12s, border-color .12s',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: isMultiple ? 'var(--pos-r-xs)' : 999,
                            border: `2px solid ${selected ? 'var(--pos-accent)' : 'var(--pos-line-strong)'}`,
                            background: selected ? 'var(--pos-accent)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {selected && (
                            <Check style={{ width: 12, height: 12, color: 'var(--pos-accent-contrast)' }} />
                          )}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--pos-ink)' }}>
                          {option.name}
                        </span>
                      </span>
                      {option.priceModifier > 0 && (
                        <span
                          className="pos-mono"
                          style={{ fontSize: 13, color: 'var(--pos-ink-3)' }}
                        >
                          +{formatPrice(option.priceModifier)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 18px calc(14px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid var(--pos-line)',
            background: 'var(--pos-surface)',
            flexShrink: 0,
          }}
        >
          <div>
            <p style={{ fontSize: 11, color: 'var(--pos-ink-3)', margin: 0 }}>
              {t('productOptions.total')}
            </p>
            <p
              className="pos-mono"
              style={{ fontSize: 20, fontWeight: 700, color: 'var(--pos-ink)', margin: 0 }}
            >
              {formatPrice(totalPrice)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!hasRequiredSelections}
            style={{
              padding: '14px 22px',
              background: hasRequiredSelections ? 'var(--pos-accent)' : 'var(--pos-line)',
              color: hasRequiredSelections ? 'var(--pos-accent-contrast)' : 'var(--pos-ink-3)',
              border: 'none',
              borderRadius: 'var(--pos-r-md)',
              fontSize: 15,
              fontWeight: 700,
              cursor: hasRequiredSelections ? 'pointer' : 'not-allowed',
            }}
          >
            {t('productOptions.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
