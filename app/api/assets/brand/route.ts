import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createServiceSupabaseClient } from '@/lib/supabase/service';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { getPublicUrlForBucket } from '@/lib/storage/s3';
import { inferBrandAssetType, isBrandAssetType } from '@/features/brand-vault/lib/brandMilestones';
import { trackActivity } from '@/features/gamification/actions/trackActivity';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { files, companyId, assetType: rawAssetType } = body as {
    files: Array<{ name: string; s3Key: string; contentType: string; size: number }>;
    companyId: string;
    assetType?: string | null;
  };

  await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();

  const overrideType =
    rawAssetType && typeof rawAssetType === 'string' && rawAssetType !== 'auto' && isBrandAssetType(rawAssetType)
      ? rawAssetType
      : null;

  const rows = (files ?? []).map((f) => ({
    tenant_id:    companyId,
    name:         f.name,
    type:         overrideType ?? inferBrandAssetType(f.contentType, f.name),
    url:          getPublicUrlForBucket('brand', f.s3Key),
    storage_key:  f.s3Key,
    file_size:    f.size ?? null,
    is_public:    false,
  }));

  const { data: inserted, error } = await supabase
    .from('brand_assets')
    .insert(rows)
    .select('id');

  if (error) {
    console.error('[api/assets/brand]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await trackActivity('brand_asset_uploaded');

  const ids = (inserted ?? []).map((r) => r.id as string);
  if (ids.length > 0) {
    const service = createServiceSupabaseClient();
    if (service) {
      after(async () => {
        const { indexBrandAsset } = await import('@/features/brand-vault/lib/indexBrandAsset');
        for (const id of ids) {
          const { data: row } = await service
            .from('brand_assets')
            .select('tenant_id')
            .eq('id', id)
            .maybeSingle();
          if (row?.tenant_id === companyId) {
            await indexBrandAsset(service, id);
          }
        }
      });
    } else {
      for (const id of ids) {
        try {
          const { indexBrandAsset } = await import('@/features/brand-vault/lib/indexBrandAsset');
          await indexBrandAsset(supabase, id);
        } catch (e) {
          console.error('[api/assets/brand] index inline', e);
        }
      }
    }
  }

  return NextResponse.json({ success: true, count: rows.length, ids });
}
