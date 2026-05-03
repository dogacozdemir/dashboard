'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

const DEFAULT_SRC = '/madmonos-logo-optimized.png';

interface TenantLogoMarkProps {
  brandLogoUrl?: string | null;
  alt?: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

/**
 * Shell logo: tenant white-label URL when set, otherwise Madmonos mark.
 * Remote URLs use unoptimized <img> to avoid Next image domain config.
 */
export function TenantLogoMark({
  brandLogoUrl,
  alt = 'Brand logo',
  width,
  height,
  className,
  priority,
}: TenantLogoMarkProps) {
  const trimmed = brandLogoUrl?.trim();
  const remote = Boolean(trimmed && /^https?:\/\//i.test(trimmed));

  if (remote) {
    return (
      <img
        src={trimmed}
        alt={alt}
        width={width}
        height={height}
        className={cn('object-contain', className)}
        loading={priority ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <Image
      src={DEFAULT_SRC}
      alt="Madmonos"
      width={width}
      height={height}
      className={cn('object-contain', className)}
      priority={priority}
    />
  );
}
