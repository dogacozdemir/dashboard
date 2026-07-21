'use client';

import Image from 'next/image';
import { useState } from 'react';
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
 * Shell logo: tenant white-label URL when set, otherwise the Madmonos mark.
 * Remote URLs use an unoptimized <img> (avoids Next image-domain config) and
 * fall back to the Madmonos logo on load error, so a dead brand URL never
 * renders as a broken image.
 */
export function TenantLogoMark({
  brandLogoUrl,
  alt = 'Brand logo',
  width,
  height,
  className,
  priority,
}: TenantLogoMarkProps) {
  const [failed, setFailed] = useState(false);
  const trimmed = brandLogoUrl?.trim();
  const remote = Boolean(trimmed && /^https?:\/\//i.test(trimmed));

  if (remote && !failed) {
    return (
      <img
        src={trimmed}
        alt={alt}
        width={width}
        height={height}
        className={cn('object-contain', className)}
        loading={priority ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
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
