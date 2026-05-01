import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export type StorageBucket = 'creative' | 'brand';

const BUCKET_MAP: Record<StorageBucket, string> = {
  creative: process.env.AWS_S3_BUCKET_CREATIVE ?? 'madmonos-creative',
  brand:    process.env.AWS_S3_BUCKET_BRAND    ?? 'madmonos-brand',
};

export const s3 = new S3Client({
  region:      process.env.AWS_REGION       ?? 'eu-central-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

/**
 * S3 key convention: {tenantId}/{folder}/{filename}
 * Example: acme-corp-uuid/creatives/hero-video.mp4
 */
export function buildS3Key(
  tenantId: string,
  folder: string,
  filename: string
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${tenantId}/${folder}/${Date.now()}_${sanitized}`;
}

/**
 * Returns a pre-signed URL the client can use to upload directly to S3.
 * The file never passes through our server → zero bandwidth cost on our end.
 * URL expires in 10 minutes.
 */
export async function createPresignedUploadUrl({
  bucket,
  key,
  contentType,
  contentLength,
}: {
  bucket: StorageBucket;
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket:        BUCKET_MAP[bucket],
    Key:           key,
    ContentType:   contentType,
    ContentLength: contentLength,
    // Server-side encryption
    ServerSideEncryption: 'AES256',
  });

  return getSignedUrl(s3, command, { expiresIn: 600 });
}

/**
 * Returns a pre-signed URL for secure private file download.
 * URL expires in 1 hour (suitable for client-side display/download).
 */
export async function createPresignedDownloadUrl({
  bucket,
  key,
  expiresIn = 3600,
}: {
  bucket: StorageBucket;
  key: string;
  expiresIn?: number;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_MAP[bucket],
    Key:    key,
  });

  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Returns the public CDN URL if CloudFront is configured,
 * otherwise falls back to the S3 public URL.
 * Only use this for objects in public-read buckets/paths.
 */
export function getPublicUrl(key: string): string {
  const cdnBase = process.env.AWS_CLOUDFRONT_URL;
  if (cdnBase) return `${cdnBase.replace(/\/$/, '')}/${key}`;

  const bucket = process.env.AWS_S3_BUCKET_CREATIVE ?? 'madmonos-creative';
  const region = process.env.AWS_REGION ?? 'eu-central-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/** Public URL for a specific bucket (Brand Vault must use `brand`, not creative). */
export function getPublicUrlForBucket(bucket: StorageBucket, key: string): string {
  const cdnBase = process.env.AWS_CLOUDFRONT_URL;
  if (cdnBase) return `${cdnBase.replace(/\/$/, '')}/${key}`;

  const b      = BUCKET_MAP[bucket];
  const region = process.env.AWS_REGION ?? 'eu-central-1';
  return `https://${b}.s3.${region}.amazonaws.com/${key}`;
}

/** Read object bytes from S3 (server-side; works for private buckets). */
export async function getS3ObjectBuffer(
  bucket: StorageBucket,
  key: string,
): Promise<Buffer> {
  const out = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET_MAP[bucket], Key: key }),
  );
  if (!out.Body) throw new Error('Empty S3 response body');
  const bytes = await out.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Uploads a buffer directly from the server to S3.
 * Use this for server-generated files (AI PDFs, exports) rather than presigned URLs.
 */
export async function putS3Object({
  bucket,
  key,
  body,
  contentType,
}: {
  bucket:      StorageBucket;
  key:         string;
  body:        Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket:               BUCKET_MAP[bucket],
      Key:                  key,
      Body:                 body,
      ContentType:          contentType,
      ServerSideEncryption: 'AES256',
    }),
  );
}

/** Permanently deletes a file from S3. */
export async function deleteS3Object(
  bucket: StorageBucket,
  key: string
): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({ Bucket: BUCKET_MAP[bucket], Key: key })
  );
}

/** Checks whether a key exists in S3 (useful for post-upload verification). */
export async function s3ObjectExists(
  bucket: StorageBucket,
  key: string
): Promise<boolean> {
  try {
    await s3.send(
      new HeadObjectCommand({ Bucket: BUCKET_MAP[bucket], Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

export const ALLOWED_MIME_TYPES = {
  image:   ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
  video:   ['video/mp4', 'video/webm', 'video/quicktime'],
  doc:     ['application/pdf'],
  font:    ['font/ttf', 'font/otf', 'font/woff', 'font/woff2'],
} as const;

export type AssetMimeCategory = keyof typeof ALLOWED_MIME_TYPES;

export function getMimeCategory(contentType: string): AssetMimeCategory | null {
  for (const [cat, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if ((types as readonly string[]).includes(contentType)) {
      return cat as AssetMimeCategory;
    }
  }
  return null;
}

export const MAX_SIZES: Record<AssetMimeCategory, number> = {
  image: parseInt(process.env.NEXT_PUBLIC_MAX_IMAGE_SIZE ?? '20971520'),
  video: parseInt(process.env.NEXT_PUBLIC_MAX_VIDEO_SIZE ?? '524288000'),
  doc:   parseInt(process.env.NEXT_PUBLIC_MAX_DOC_SIZE   ?? '52428800'),
  font:  10_485_760, // 10 MB
};
