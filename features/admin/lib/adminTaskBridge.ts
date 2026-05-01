import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createAdminTaskTranslator } from '@/lib/i18n/admin-task-translator';
import type { AdminTaskPriority, AdminTaskType } from '../types/admin-tasks';

function getAdmin() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

type TenantMini = { id: string; name: string; slug: string };

async function fetchTenantMini(admin: NonNullable<ReturnType<typeof getAdmin>>, tenantId: string): Promise<TenantMini | null> {
  const { data } = await admin.from('tenants').select('id, name, slug').eq('id', tenantId).maybeSingle();
  if (!data) return null;
  return data as TenantMini;
}

/**
 * Lux operational notification on the **subject tenant** so Super Admins see it
 * when they open that tenant (bell + realtime). RLS allows super_admin to select all.
 */
export async function notifySuperAdminsLux(input: {
  tenantId: string;
  message: string;
  actionPath: string;
  actionLabel: string;
}): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;

  const t = createAdminTaskTranslator();

  const { error } = await admin.from('notifications').insert({
    tenant_id:     input.tenantId,
    user_id:       null,
    sender_name:   t('Admin.tasks.notifySender'),
    message:       input.message,
    type:          'approval',
    category:      'operational',
    action_url:    input.actionPath,
    action_label:  input.actionLabel,
    is_read:       false,
  });

  if (error) console.error('[notifySuperAdminsLux]', error.message);
}

async function upsertOpenTask(params: {
  tenantId: string;
  taskType: AdminTaskType;
  priority: AdminTaskPriority;
  title: string;
  body?: string;
  targetPath: string;
  relatedEntityId?: string | null;
  dedupeKey: string;
  notify?: { message: string; actionLabel?: string };
}): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;

  const { data: existing } = await admin
    .from('admin_tasks')
    .select('id')
    .eq('dedupe_key', params.dedupeKey)
    .eq('status', 'open')
    .maybeSingle();

  if (existing) return;

  const { error } = await admin.from('admin_tasks').insert({
    tenant_id:         params.tenantId,
    task_type:         params.taskType,
    priority:          params.priority,
    status:            'open',
    title:             params.title,
    body:              params.body ?? null,
    target_path:       params.targetPath,
    related_entity_id: params.relatedEntityId ?? null,
    dedupe_key:        params.dedupeKey,
  });

  if (error) {
    console.error('[upsertOpenTask]', error.message);
    return;
  }

  if (params.notify) {
    const t = createAdminTaskTranslator();
    await notifySuperAdminsLux({
      tenantId:     params.tenantId,
      message:      params.notify.message,
      actionPath:   params.targetPath,
      actionLabel:  params.notify.actionLabel ?? t('Admin.tasks.actionBrowse'),
    });
  }
}

export async function recordCreativePendingAdminTasks(
  rows: Array<{ id: string; tenant_id: string; title: string }>,
): Promise<void> {
  if (!rows.length) return;
  const admin = getAdmin();
  const tenant = admin ? await fetchTenantMini(admin, rows[0].tenant_id) : null;
  const t = createAdminTaskTranslator();
  const tname = tenant?.name ?? t('Admin.tasks.tenantFallback');

  for (const r of rows) {
    await upsertOpenTask({
      tenantId:         r.tenant_id,
      taskType:         'CREATIVE_APPROVAL_PENDING',
      priority:         'high',
      title:            t('Admin.tasks.creativePendingTitle', { title: r.title }),
      body:             t('Admin.tasks.creativePendingBody'),
      targetPath:       '/creative',
      relatedEntityId:  r.id,
      dedupeKey:        `creative:pending:${r.id}`,
    });
  }

  const tid = rows[0].tenant_id;
  const summary =
    rows.length === 1
      ? t('Admin.tasks.creativePendingNotifySingle', { tenant: tname, title: rows[0].title })
      : t('Admin.tasks.creativePendingNotifyMulti', { tenant: tname, count: rows.length });
  await notifySuperAdminsLux({
    tenantId:     tid,
    message:      summary,
    actionPath:   '/creative',
    actionLabel:  t('Admin.tasks.actionGoCreative'),
  });
}

export async function recordCreativeRevisionAdminTask(input: {
  assetId: string;
  tenantId: string;
  assetTitle: string;
}): Promise<void> {
  const admin = getAdmin();
  const tenant = admin ? await fetchTenantMini(admin, input.tenantId) : null;
  const t = createAdminTaskTranslator();
  const tname = tenant?.name ?? t('Admin.tasks.tenantFallback');

  await upsertOpenTask({
    tenantId:         input.tenantId,
    taskType:         'CREATIVE_REVISION_REQUEST',
    priority:         'critical',
    title:            t('Admin.tasks.creativeRevisionTitle', { title: input.assetTitle }),
    body:             t('Admin.tasks.creativeRevisionBody'),
    targetPath:       '/creative',
    relatedEntityId:  input.assetId,
    dedupeKey:        `creative:revision:${input.assetId}`,
    notify: {
      message:     t('Admin.tasks.creativeRevisionNotify', { tenant: tname, title: input.assetTitle }),
      actionLabel: t('Admin.tasks.actionOpenRevision'),
    },
  });

  if (admin) {
    await admin
      .from('admin_tasks')
      .update({ status: 'done', resolved_at: new Date().toISOString() })
      .eq('status', 'open')
      .eq('task_type', 'CREATIVE_APPROVAL_PENDING')
      .eq('related_entity_id', input.assetId);
  }
}

export async function resolveCreativeAdminTasksAfterStatus(input: {
  assetId: string;
  tenantId: string;
  newStatus: 'pending' | 'approved' | 'revision';
  assetTitle: string;
}): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;

  const t = createAdminTaskTranslator();

  if (input.newStatus === 'approved') {
    await admin
      .from('admin_tasks')
      .update({ status: 'done', resolved_at: new Date().toISOString() })
      .eq('status', 'open')
      .in('task_type', ['CREATIVE_APPROVAL_PENDING', 'CREATIVE_REVISION_REQUEST'])
      .eq('related_entity_id', input.assetId);

    const tenant = await fetchTenantMini(admin, input.tenantId);
    const tname = tenant?.name ?? t('Admin.tasks.tenantFallback');
    await notifySuperAdminsLux({
      tenantId:     input.tenantId,
      message:      t('Admin.tasks.approvedNotify', { tenant: tname, title: input.assetTitle }),
      actionPath:   '/creative',
      actionLabel:  t('Admin.tasks.actionGoCreative'),
    });
    return;
  }

  if (input.newStatus === 'pending') {
    return;
  }

  if (input.newStatus === 'revision') {
    await admin
      .from('admin_tasks')
      .update({ status: 'done', resolved_at: new Date().toISOString() })
      .eq('status', 'open')
      .eq('task_type', 'CREATIVE_APPROVAL_PENDING')
      .eq('related_entity_id', input.assetId);
  }
}
