import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { getPublicUrl } from '@/lib/storage/s3';

function inferBrandAssetType(contentType: string, filename: string): string {
  if (contentType.includes('pdf'))             return 'brand-book';
  if (contentType.startsWith('font/')
   || filename.match(/\.(ttf|otf|woff2?)$/i))  return 'font';
  if (contentType.startsWith('image/'))        return 'logo';
  return 'other';
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { files, companyId } = await request.json();

  // IDOR defense
  await requireTenantAction(companyId);

  const supabase = await createSupabaseServerClient();

  const rows = (files as Array<{ name: string; s3Key: string; contentType: string; size: number }>)
    .map((f) => ({
      tenant_id:  companyId,
      name:       f.name,
      type:       inferBrandAssetType(f.contentType, f.name),
      url:        getPublicUrl(f.s3Key),
      file_size:  f.size ?? null,
      is_public:  false,
    }));

  const { error } = await supabase.from('brand_assets').insert(rows);
  if (error) {
    console.error('[api/assets/brand]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: rows.length });
}
