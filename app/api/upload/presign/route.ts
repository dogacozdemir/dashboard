import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import {
  buildS3Key,
  createPresignedUploadUrl,
  getMimeCategory,
  MAX_SIZES,
  type StorageBucket,
} from '@/lib/storage/s3';
import type { SessionUser } from '@/types/user';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import { premiumSessionRequiredMessage } from '@/lib/i18n/premium-action-errors';

export interface PresignRequest {
  filename:      string;
  contentType:   string;
  contentLength: number;
  bucket:        StorageBucket;
  folder?:       string;
}

export interface PresignResponse {
  uploadUrl: string;
  s3Key:     string;
}

export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: await premiumSessionRequiredMessage() }, { status: 401 });
  }
  const user = session.user as SessionUser;

  if (!user.tenantId) {
    return NextResponse.json({ error: 'Tenant context required' }, { status: 403 });
  }

  // 2. Parse body
  let body: PresignRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { filename, contentType, contentLength, bucket, folder = 'uploads' } = body;

  if (bucket === 'creative' && !sessionHasPermission(user, 'creative.upload')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (bucket === 'brand' && !sessionHasPermission(user, 'brand.upload')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Validate MIME type
  const category = getMimeCategory(contentType);
  if (!category) {
    return NextResponse.json(
      { error: `File type "${contentType}" is not allowed` },
      { status: 415 }
    );
  }

  // 4. Validate file size (server-side enforcement)
  const maxSize = MAX_SIZES[category];
  if (contentLength > maxSize) {
    const mb = (maxSize / 1_048_576).toFixed(0);
    return NextResponse.json(
      { error: `File too large. Maximum size for ${category} is ${mb} MB` },
      { status: 413 }
    );
  }

  // 5. Build scoped S3 key (tenantId prefix isolates files per tenant)
  const tenantId = user.tenantId;
  const s3Key = buildS3Key(tenantId, folder, filename);

  // 6. Generate presigned URL
  try {
    const uploadUrl = await createPresignedUploadUrl({
      bucket,
      key:           s3Key,
      contentType,
      contentLength,
    });

    return NextResponse.json({ uploadUrl, s3Key } satisfies PresignResponse);
  } catch (err) {
    console.error('[presign] S3 error:', err);
    return NextResponse.json(
      { error: 'Could not generate upload URL. Check AWS credentials.' },
      { status: 500 }
    );
  }
}
