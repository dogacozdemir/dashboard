'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import type { BrandAsset } from '../types';

export async function fetchBrandAssets(companyId: string): Promise<BrandAsset[]> {
  const validatedId = await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('brand_assets')
    .select(
      'id, name, type, url, file_size, is_public, created_at, storage_key, indexing_status, indexing_error, indexed_at',
    )
    .eq('tenant_id', validatedId)
    .order('type', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchBrandAssets]', error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((a) => ({
    id:              a.id,
    name:            a.name,
    type:            a.type as BrandAsset['type'],
    url:             a.url,
    fileSize:        a.file_size,
    isPublic:        a.is_public,
    createdAt:       a.created_at,
    storageKey:      a.storage_key ?? null,
    indexingStatus:  (a.indexing_status as BrandAsset['indexingStatus']) ?? undefined,
    indexingError:   a.indexing_error ?? null,
    indexedAt:       a.indexed_at ?? null,
  }));
}
