'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/cart-store';
import type { Product } from '@/types/product';
import { ProductOptionsModal } from './product-options-modal';

interface PosProductGridProps {
  products: Product[];
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

export function PosProductGrid({ products }: PosProductGridProps) {
  const { addItem } = useCartStore();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleProductClick = (product: Product) => {
    if (product.options?.groups && product.options.groups.length > 0) {
      setSelectedProduct(product);
    } else {
      addItem(product, 1, []);
    }
  };

  const handleAddWithOptions = (
    product: Product,
    selectedOptions: Array<{ group: string; option: string; priceModifier: number; excluded?: boolean }>
  ) => {
    addItem(product, 1, selectedOptions);
    setSelectedProduct(null);
  };

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 10,
        }}
      >
        {products.map((product) => {
          const isOutOfStock = product.trackInventory && product.stockQuantity <= 0;
          const isUnavailable = !product.isAvailable;
          const isDisabled = isOutOfStock || isUnavailable;
          const lowStock =
            !isUnavailable &&
            product.trackInventory &&
            product.stockQuantity > 0 &&
            product.stockQuantity <= 5;

          return (
            <button
              key={product.id}
              type="button"
              onClick={() => handleProductClick(product)}
              disabled={isDisabled}
              style={{
                position: 'relative',
                textAlign: 'left',
                background: 'var(--pos-surface)',
                border: `1px solid ${isDisabled ? 'var(--pos-line)' : 'var(--pos-line)'}`,
                borderRadius: 'var(--pos-r-md)',
                padding: 11,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: 'var(--pos-sh-1)',
                opacity: isDisabled ? 0.55 : 1,
                transition: 'border-color .12s, transform .08s, box-shadow .12s',
              }}
              onPointerDown={(e) => { if (!isDisabled) e.currentTarget.style.transform = 'scale(.98)'; }}
              onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseEnter={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.borderColor = 'var(--pos-accent)';
                  e.currentTarget.style.boxShadow = 'var(--pos-sh-2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--pos-line)';
                e.currentTarget.style.boxShadow = 'var(--pos-sh-1)';
              }}
            >
              {/* Icon / image area */}
              <div
                style={{
                  height: 72,
                  borderRadius: 'var(--pos-r-sm)',
                  background: 'var(--pos-accent-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 40,
                  lineHeight: 1,
                  overflow: 'hidden',
                }}
                aria-hidden
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  /* Category icon fallback, then generic */
                  product.category?.icon || '🍽️'
                )}
              </div>

              {/* Name + variant */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    color: 'var(--pos-ink)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {product.name}
                </div>
                {product.description && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--pos-ink-3)',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {product.description}
                  </div>
                )}
                {product.options?.groups && product.options.groups.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--pos-accent-ink)', fontWeight: 500 }}>
                    + Optionen
                  </div>
                )}
              </div>

              {/* Price + add button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                }}
              >
                <span
                  className="pos-mono"
                  style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos-ink)' }}
                >
                  {formatPrice(product.price)}
                </span>
                {!isDisabled && (
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background: 'var(--pos-accent)',
                      color: 'var(--pos-accent-contrast)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    +
                  </span>
                )}
              </div>

              {/* Unavailable banner */}
              {isUnavailable && (
                <span
                  style={{
                    position: 'absolute',
                    inset: 'auto 0 0 0',
                    background: 'var(--pos-danger)',
                    color: '#fff',
                    borderBottomLeftRadius: 'var(--pos-r-md)',
                    borderBottomRightRadius: 'var(--pos-r-md)',
                    padding: '3px 0',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Nicht verfügbar
                </span>
              )}

              {/* Low stock warning */}
              {lowStock && (
                <span
                  style={{
                    position: 'absolute',
                    inset: 'auto 0 0 0',
                    background: 'var(--pos-warn)',
                    color: 'var(--pos-ink)',
                    borderBottomLeftRadius: 'var(--pos-r-md)',
                    borderBottomRightRadius: 'var(--pos-r-md)',
                    padding: '3px 0',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {product.stockQuantity} übrig
                </span>
              )}

              {/* Out of stock overlay */}
              {isOutOfStock && !isUnavailable && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.75)',
                    borderRadius: 'var(--pos-r-md)',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pos-danger)' }}>
                    Ausverkauft
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedProduct && (
        <ProductOptionsModal
          isOpen={!!selectedProduct}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={(options) => handleAddWithOptions(selectedProduct, options)}
        />
      )}
    </>
  );
}
