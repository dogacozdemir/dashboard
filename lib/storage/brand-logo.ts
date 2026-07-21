import 'server-only';

import { createPresignedDownloadUrl } from '@/lib/storage/s3';
import { extractS3Key, normalizeDuplicateTenantKey } from '@/features/creative-studio/lib/creativeS3Keys';

/**
 * `tenants.brand_logo_url` stores a raw S3 URL, but the brand bucket is private —
 * handing that URL straight to an <img> yields a 403 and a broken logo in the
 * sidebar, mobile nav, board report and Instagram preview alike. Creative assets
 * already get presigned on read; brand logos need the same treatment.
 *
 * Returns the original value untouched when it isn't an S3 object we can sign
 * (external CDN, data URI, or a bucket miss), so nothing regresses to null.
 */
export async function signBrandLogoUrl(rawUrl: string | null | undefined): Promise<string | null> {
  const value = rawUrl?.trim();
  if (!value) return null;

  // Already-public sources (CloudFront, data URIs, other hosts) need no signing.
  if (value.startsWith('data:')) return value;

  const cdn = process.env.AWS_CLOUDFRONT_URL?.trim();
  if (cdn && value.startsWith(cdn)) return value;

  const key = normalizeDuplicateTenantKey(extractS3Key(value));
  if (!key || key === value) return value;

  const bucket = key.includes('/creative/') ? 'creative' : 'brand';

  try {
    return await createPresignedDownloadUrl({ bucket, key, expiresIn: 3600 });
  } catch {
    return value;
  }
}
