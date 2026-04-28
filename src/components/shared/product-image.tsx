'use client';

import { PosIcon } from '@openeos/pos-icons';
import { ShoppingBag01 } from '@untitledui/icons';
import { cx } from '@/utils/cx';

const sizes = {
  sm: 32,
  md: 48,
  lg: 64,
} as const;

interface ProductImageProps {
  imageUrl: string | null | undefined;
  productName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProductImage({ imageUrl, productName, size = 'md', className }: ProductImageProps) {
  const px = sizes[size];

  if (imageUrl?.startsWith('pos-icon:')) {
    const iconId = imageUrl.slice(9);
    return (
      <div
        className={cx(
          'flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800',
          className,
        )}
        style={{ width: px, height: px }}
      >
        <PosIcon id={iconId} size={Math.round(px * 0.75)} />
      </div>
    );
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={productName}
        className={cx('rounded-lg object-cover', className)}
        style={{ width: px, height: px }}
      />
    );
  }

  // Fallback placeholder
  const iconSize = size === 'sm' ? 'size-4' : size === 'md' ? 'size-5' : 'size-6';
  return (
    <div
      className={cx(
        'flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800',
        className,
      )}
      style={{ width: px, height: px }}
    >
      <ShoppingBag01 className={cx(iconSize, 'text-gray-500')} />
    </div>
  );
}
