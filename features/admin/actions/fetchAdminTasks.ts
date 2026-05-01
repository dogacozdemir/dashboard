'use server';

import { auth } from '@/lib/auth/config';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdminSession } from '@/lib/auth/tenant-guard';
import { resolveEffectiveLocale } from '@/lib/i18n/resolve-effective-locale';
import { createAdminTaskTranslator } from '@/lib/i18n/admin-task-translator';
import type { SessionUser } from '@/types/user';
import type {
  AdminOpsPayload,
  AdminOpsTaskItem,
  AdminRecentApprovalItem,
  AdminTaskPriority,
  AdminTaskType,
} from '../types/admin-tasks';

const PRIORITY_RANK: Record<AdminTaskPriority, number> = {
  critical: 0,
  high:     1,
  medium:   2,
  low:      3,
};

function sortTasks(a: AdminOpsTaskItem, b: AdminOpsTaskItem) {
  const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (pr !== 0) return pr;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/** Cumulative Ops Center payload for Super Admin /to-do. */
export async function fetchAdminTasks(): Promise<AdminOpsPayload> {
  await requireAdminSession();

  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const locale = await resolveEffectiveLocale(user?.locale);
  const translate = createAdminTaskTranslator(locale);

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { activeTasks: [], recentApprovals: [] };
  }

  const [
    { data: openRows },
    { data: tenants },
    { data: brandAssetRows },
    { data: chunkRows },
    { data: approvalRows },
  ] = await Promise.all([
    admin
      .from('admin_tasks')
      .select(
        'id, tenant_id, task_type, priority, title, body, target_path, related_entity_id, created_at',
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(200),
    admin.from('tenants').select('id, slug, name, is_active').eq('is_active', true),
    admin.from('brand_assets').select('tenant_id'),
    admin.from('brand_knowledge_chunks').select('tenant_id'),
    admin
      .from('creative_assets')
      .select('id, title, tenant_id, updated_at')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(14),
  ]);

  const tenantMap = new Map(
    (tenants ?? []).map((t) => {
      const row = t as { id: string; slug: string; name: string };
      return [row.id, row] as const;
    }),
  );

  const extraTenantIds = [
    ...new Set([
      ...(approvalRows ?? []).map((row) => (row as { tenant_id: string }).tenant_id),
      ...(openRows ?? []).map((row) => (row as { tenant_id: string }).tenant_id),
    ]),
  ].filter((id) => !tenantMap.has(id));
  if (extraTenantIds.length > 0) {
    const { data: extraTenants } = await admin
      .from('tenants')
      .select('id, slug, name')
      .in('id', extraTenantIds);
    for (const t of extraTenants ?? []) {
      const row = t as { id: string; slug: string; name: string };
      tenantMap.set(row.id, row);
    }
  }

  const assetCount = new Map<string, number>();
  for (const r of brandAssetRows ?? []) {
    const id = (r as { tenant_id: string }).tenant_id;
    assetCount.set(id, (assetCount.get(id) ?? 0) + 1);
  }
  const chunkCount = new Map<string, number>();
  for (const r of chunkRows ?? []) {
    const id = (r as { tenant_id: string }).tenant_id;
    chunkCount.set(id, (chunkCount.get(id) ?? 0) + 1);
  }

  const activeTasks: AdminOpsTaskItem[] = [];

  for (const row of openRows ?? []) {
    const r = row as {
      id: string;
      tenant_id: string;
      task_type: string;
      priority: AdminTaskPriority;
      title: string;
      body: string | null;
      target_path: string;
      related_entity_id: string | null;
      created_at: string;
    };
    const tn = tenantMap.get(r.tenant_id);
    if (!tn) continue;
    activeTasks.push({
      id:               r.id,
      source:           'database',
      tenantId:         r.tenant_id,
      tenantSlug:       tn.slug,
      tenantName:       tn.name,
      taskType:         r.task_type as AdminTaskType,
      priority:         r.priority,
      title:            r.title,
      body:             r.body,
      targetPath:       r.target_path,
      relatedEntityId:  r.related_entity_id,
      createdAt:        r.created_at,
    });
  }

  for (const t of tenants ?? []) {
    const tid = (t as { id: string; slug: string; name: string }).id;
    const slug = (t as { slug: string }).slug;
    const name = (t as { name: string }).name;
    const ba = assetCount.get(tid) ?? 0;
    const bc = chunkCount.get(tid) ?? 0;
    if (ba === 0 || bc === 0) {
      activeTasks.push({
        id:               `computed:vault:${tid}`,
        source:           'computed',
        tenantId:         tid,
        tenantSlug:       slug,
        tenantName:       name,
        taskType:         'MISSING_BRAND_VAULT',
        priority:         'medium',
        title:            translate('Admin.tasks.vaultMissingTitle'),
        body:
          ba === 0 && bc === 0
            ? translate('Admin.tasks.vaultMissingBodyBoth')
            : ba === 0
              ? translate('Admin.tasks.vaultMissingBodyAssets')
              : translate('Admin.tasks.vaultMissingBodyChunks'),
        targetPath:       '/brand-vault',
        relatedEntityId:  null,
        createdAt:        new Date(0).toISOString(),
      });
    }
  }

  activeTasks.sort(sortTasks);

  const recentApprovals: AdminRecentApprovalItem[] = (approvalRows ?? []).map((row) => {
    const r = row as {
      id: string;
      title: string;
      tenant_id: string;
      updated_at: string;
    };
    const tn = tenantMap.get(r.tenant_id);
    return {
      assetId:    r.id,
      title:      r.title,
      tenantSlug: tn?.slug ?? '',
      tenantName: tn?.name ?? '',
      updatedAt:  r.updated_at,
    };
  });

  return { activeTasks, recentApprovals };
}
