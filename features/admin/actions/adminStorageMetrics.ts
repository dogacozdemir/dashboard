'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/auth/tenant-guard';

export type AdminAssetSource = 'brand' | 'creative';

export type AdminStorageTenantRow = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  fileCount: number;
  totalBytes: number;
};

export type AdminRecentUploadRow = {
  id: string;
  fileName: string;
  tenantName: string;
  tenantSlug: string;
  fileSizeBytes: number | null;
  source: AdminAssetSource;
  mediaType: string;
  createdAt: string;
};

export type AdminStorageMetrics = {
  totalBytes: number;
  totalFiles: number;
  filesThisMonth: number;
  tenantsWithFiles: number;
  tenantBreakdown: AdminStorageTenantRow[];
  recentUploads: AdminRecentUploadRow[];
};

type NormalizedAsset = {
  id: string;
  tenantId: string;
  fileName: string;
  fileSizeBytes: number | null;
  source: AdminAssetSource;
  mediaType: string;
  createdAt: string;
};

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function normalizeBrand(row: Record<string, unknown>): NormalizedAsset {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    fileName: row.name as string,
    fileSizeBytes: row.file_size != null ? Number(row.file_size) : null,
    source: 'brand',
    mediaType: row.type as string,
    createdAt: row.created_at as string,
  };
}

function normalizeCreative(row: Record<string, unknown>): NormalizedAsset {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    fileName: row.title as string,
    fileSizeBytes: row.file_size != null ? Number(row.file_size) : null,
    source: 'creative',
    mediaType: row.type as string,
    createdAt: row.created_at as string,
  };
}

function buildMetrics(
  assets: NormalizedAsset[],
  tenantMap: Map<string, { name: string; slug: string }>,
): AdminStorageMetrics {
  const sinceMonth = monthStartIso();
  let totalBytes = 0;
  let filesThisMonth = 0;

  const byTenant = new Map<string, { fileCount: number; totalBytes: number }>();

  for (const a of assets) {
    const size = a.fileSizeBytes ?? 0;
    totalBytes += size;
    if (a.createdAt >= sinceMonth) filesThisMonth += 1;

    const cur = byTenant.get(a.tenantId) ?? { fileCount: 0, totalBytes: 0 };
    cur.fileCount += 1;
    cur.totalBytes += size;
    byTenant.set(a.tenantId, cur);
  }

  const tenantBreakdown: AdminStorageTenantRow[] = [...byTenant.entries()]
    .map(([tenantId, stats]) => {
      const tn = tenantMap.get(tenantId);
      return {
        tenantId,
        tenantName: tn?.name ?? tenantId.slice(0, 8),
        tenantSlug: tn?.slug ?? '—',
        fileCount: stats.fileCount,
        totalBytes: stats.totalBytes,
      };
    })
    .sort((a, b) => b.totalBytes - a.totalBytes || b.fileCount - a.fileCount);

  const recentUploads: AdminRecentUploadRow[] = [...assets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)
    .map((a) => {
      const tn = tenantMap.get(a.tenantId);
      return {
        id: a.id,
        fileName: a.fileName,
        tenantName: tn?.name ?? '—',
        tenantSlug: tn?.slug ?? '—',
        fileSizeBytes: a.fileSizeBytes,
        source: a.source,
        mediaType: a.mediaType,
        createdAt: a.createdAt,
      };
    });

  return {
    totalBytes,
    totalFiles: assets.length,
    filesThisMonth,
    tenantsWithFiles: byTenant.size,
    tenantBreakdown,
    recentUploads,
  };
}

const EMPTY: AdminStorageMetrics = {
  totalBytes: 0,
  totalFiles: 0,
  filesThisMonth: 0,
  tenantsWithFiles: 0,
  tenantBreakdown: [],
  recentUploads: [],
};

/** God Mode storage audit — brand vault + creative slides aggregated by tenant. */
export async function getAdminStorageMetrics(): Promise<AdminStorageMetrics> {
  await requireAdminSession();

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    admin = null;
  }

  const supabase = admin ?? (await createSupabaseServerClient());

  const [
    { data: brandRows, error: brandErr },
    { data: creativeRows, error: creativeErr },
    { data: tenantRows, error: tenantErr },
  ] = await Promise.all([
    supabase
      .from('brand_assets')
      .select('id, tenant_id, name, file_size, type, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('creative_assets')
      .select('id, tenant_id, title, file_size, type, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('tenants').select('id, name, slug'),
  ]);

  if (brandErr) console.error('[getAdminStorageMetrics/brand]', brandErr.message);
  if (creativeErr) console.error('[getAdminStorageMetrics/creative]', creativeErr.message);
  if (tenantErr) console.error('[getAdminStorageMetrics/tenants]', tenantErr.message);

  const tenantMap = new Map(
    (tenantRows ?? []).map((t) => {
      const row = t as { id: string; name: string; slug: string };
      return [row.id, { name: row.name, slug: row.slug }] as const;
    }),
  );

  const assets: NormalizedAsset[] = [
    ...(brandRows ?? []).map((r) => normalizeBrand(r as Record<string, unknown>)),
    ...(creativeRows ?? []).map((r) => normalizeCreative(r as Record<string, unknown>)),
  ];

  if (!assets.length) return EMPTY;

  return buildMetrics(assets, tenantMap);
}
