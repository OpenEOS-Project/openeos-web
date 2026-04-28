'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/cart-store';
import { cx } from '@/utils/cx';
import { ProductImage } from '@/components/shared/product-image';
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
    // If product has options, show modal
    if (product.options?.groups && product.options.groups.length > 0) {
      setSelectedProduct(product);
    } else {
      // Otherwise, add directly to cart
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => {
          const isOutOfStock = product.trackInventory && product.stockQuantity <= 0;
          const isUnavailable = !product.isAvailable;
          const isDisabled = isOutOfStock || isUnavailable;

          const hasBanner = isUnavailable || (!isUnavailable && product.trackInventory && product.stockQuantity > 0 && product.stockQuantity <= 5);

          return (
            <button
              key={product.id}
              type="button"
              onClick={() => handleProductClick(product)}
              disabled={isDisabled}
              className={cx(
                'group relative flex rounded-xl border p-4 text-left shadow-sm transition-all',
                hasBanner && 'pb-8',
                isUnavailable
                  ? 'cursor-not-allowed border-secondary bg-primary opacity-60'
                  : isOutOfStock
                    ? 'cursor-not-allowed border-secondary bg-primary opacity-50'
                    : 'border-secondary bg-primary hover:border-brand-primary hover:shadow-md active:scale-[0.98]'
              )}
            >
              {/* Left: Text content */}
              <div className="flex min-w-0 flex-1 flex-col">
                {/* Product Name */}
                <h3 className="text-sm font-semibold text-primary line-clamp-2">
                  {product.name}
                </h3>

                {/* Description */}
                {product.description && (
                  <p className="mt-1 text-xs text-tertiary line-clamp-1">
                    {product.description}
                  </p>
                )}

                {/* Options indicator */}
                {product.options?.groups && product.options.groups.length > 0 && (
                  <span className="mt-1 text-xs text-brand-primary">
                    + Optionen
                  </span>
                )}

                {/* Price */}
                <div className="mt-auto pt-3">
                  <span className="text-lg font-bold text-primary">
                    {formatPrice(product.price)}
                  </span>
                </div>
              </div>

              {/* Right: Product Image */}
              {product.imageUrl && (
                <div className="ml-3 flex shrink-0 items-center">
                  <ProductImage imageUrl={product.imageUrl} productName={product.name} size="lg" />
                </div>
              )}

              {/* Unavailable banner */}
              {isUnavailable && (
                <span className="absolute inset-x-0 bottom-0 rounded-b-xl bg-error-secondary py-1 text-center text-xs font-medium text-error-primary dark:text-white">
                  Nicht verfügbar
                </span>
              )}

              {/* Stock warning banner */}
              {!isUnavailable && product.trackInventory && product.stockQuantity > 0 && product.stockQuantity <= 5 && (
                <span className="absolute inset-x-0 bottom-0 rounded-b-xl bg-warning-secondary py-1 text-center text-xs font-medium text-warning-primary dark:text-white">
                  {product.stockQuantity} übrig
                </span>
              )}

              {/* Out of stock overlay */}
              {isOutOfStock && !isUnavailable && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary/80">
                  <span className="text-sm font-medium text-error-primary">
                    Ausverkauft
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Product Options Modal */}
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
