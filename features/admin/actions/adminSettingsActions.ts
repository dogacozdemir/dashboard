'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/config';
import { getPremiumAdminActionError } from '@/lib/copy/premium-copy';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/auth/tenant-guard';
import type { SessionUser } from '@/types/user';
import {
  DEFAULT_SYSTEM_SETTINGS,
  SYSTEM_LOG_LEVELS,
  type SystemLogLevel,
  type SystemSettings,
} from '../types/system-settings';

function mapRow(row: Record<string, unknown>): SystemSettings {
  return {
    id: 1,
    maintenanceMode: Boolean(row.maintenance_mode),
    globalSignupsAllowed: Boolean(row.global_signups_allowed),
    systemLogLevel: row.system_log_level as SystemLogLevel,
    updatedAt: row.updated_at as string,
    updatedBy: (row.updated_by as string | null) ?? null,
  };
}

async function getClient() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return createSupabaseServerClient();
  }
}

async function seedDefaultRow(client: Awaited<ReturnType<typeof getClient>>): Promise<SystemSettings | null> {
  const { data, error } = await client
    .from('system_settings')
    .insert({
      id: 1,
      maintenance_mode: false,
      global_signups_allowed: true,
      system_log_level: 'info',
    })
    .select('id, maintenance_mode, global_signups_allowed, system_log_level, updated_at, updated_by')
    .single();

  if (error) {
    console.error('[fetchSystemSettings/seed]', error.message);
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}

/** Load singleton platform settings (seeds row 1 if missing). */
export async function fetchSystemSettings(): Promise<SystemSettings> {
  await requireAdminSession();

  const client = await getClient();
  const { data, error } = await client
    .from('system_settings')
    .select('id, maintenance_mode, global_signups_allowed, system_log_level, updated_at, updated_by')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('[fetchSystemSettings]', error.message);
    return DEFAULT_SYSTEM_SETTINGS;
  }

  if (!data) {
    const seeded = await seedDefaultRow(client);
    return seeded ?? DEFAULT_SYSTEM_SETTINGS;
  }

  return mapRow(data as Record<string, unknown>);
}

export type SystemSettingsPatch = Partial<{
  maintenanceMode: boolean;
  globalSignupsAllowed: boolean;
  systemLogLevel: SystemLogLevel;
}>;

/** Persist partial platform settings (super_admin only). */
export async function updateSystemSettings(
  payload: SystemSettingsPatch,
): Promise<{ success: boolean; error?: string; settings?: SystemSettings }> {
  await requireAdminSession();

  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.id) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  if (payload.maintenanceMode !== undefined) {
    patch.maintenance_mode = payload.maintenanceMode;
  }
  if (payload.globalSignupsAllowed !== undefined) {
    patch.global_signups_allowed = payload.globalSignupsAllowed;
  }
  if (payload.systemLogLevel !== undefined) {
    if (!SYSTEM_LOG_LEVELS.includes(payload.systemLogLevel)) {
      return { success: false, error: 'INVALID_LOG_LEVEL' };
    }
    patch.system_log_level = payload.systemLogLevel;
  }

  if (Object.keys(patch).length <= 2) {
    return { success: false, error: 'EMPTY_PATCH' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('system_settings')
    .update(patch)
    .eq('id', 1)
    .select('id, maintenance_mode, global_signups_allowed, system_log_level, updated_at, updated_by')
    .single();

  if (error) {
    console.error('[updateSystemSettings]', error.message);
    return { success: false, error: await getPremiumAdminActionError() };
  }

  revalidatePath('/settings');

  return { success: true, settings: mapRow(data as Record<string, unknown>) };
}
