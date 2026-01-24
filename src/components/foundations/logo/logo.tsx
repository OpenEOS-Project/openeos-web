'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { cx } from '@/utils/cx';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  /** Show only the icon instead of full logo */
  iconOnly?: boolean;
}

export function Logo({ className, width = 160, height = 40, iconOnly = false }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show icon only mode (small logo for collapsed sidebar)
  if (iconOnly) {
    const smallLogoSrc = mounted && resolvedTheme === 'dark' ? '/logo_small_light.png' : '/logo_small_dark.png';
    return (
      <Image
        src={smallLogoSrc}
        alt="OpenEOS"
        width={height}
        height={height}
        className={className}
        priority
      />
    );
  }

  // Dark mode = light logo (white text), Light mode = dark logo (dark text)
  const logoSrc = mounted && resolvedTheme === 'dark' ? '/logo_light.png' : '/logo_dark.png';

  return (
    <Image
      src={logoSrc}
      alt="OpenEOS"
      width={width}
      height={height}
      className={cx('h-auto w-auto', className)}
      priority
    />
  );
}

interface LogoIconProps {
  className?: string;
  size?: number;
}

export function LogoIcon({ className, size = 40 }: LogoIconProps) {
  return (
    <Image
      src="/icon.svg"
      alt="OpenEOS"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
