import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { publishInstagramPostCore } from '@/features/oauth/actions/publishInstagramPost';
import { sendPushToTenant } from '@/lib/push/send';

/**
 * Scheduled publisher — pushes approved Instagram posts live once their slot
 * arrives, closing the loop that previously ended at "approved" and required
 * someone to re-upload the creative by hand.
 *
 * Authorization: `Authorization: Bearer <CRON_SECRET>`.
 * Publishing is irreversible, so it only runs for tenants that opted in via
 * `tenants.auto_publish_instagram`, and never for demo tenants.
 *
 * Node runtime: token decryption relies on Node `crypto`.
 */
export const runtime = 'nodejs';

/** Give up after this many tries so a permanently broken post stops retrying. */
const MAX_ATTEMPTS = 3;

/** Bound the work per run — Graph calls poll for up to ~55s on video. */
const MAX_POSTS_PER_RUN = 10;

type DuePost = {
  id: string;
  tenant_id: string;
  title: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  publish_attempts: number | null;
};

/** A post is due once its scheduled local date+time has passed. */
function isDue(post: DuePost, now: Date): boolean {
  if (!post.scheduled_date) return false;
  const time = post.scheduled_time?.slice(0, 5) ?? '00:00';
  const due = new Date(`${post.scheduled_date}T${time}:00`);
  return !Number.isNaN(due.getTime()) && due.getTime() <= now.getTime();
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const { data: tenants, error: tErr } = await admin
    .from('tenants')
    .select('id, name, slug, is_demo, auto_publish_instagram')
    .eq('is_active', true)
    .eq('auto_publish_instagram', true);

  if (tErr) {
    return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  }

  const eligible = (tenants ?? []).filter(
    (t) => !(t as { is_demo?: boolean }).is_demo,
  ) as Array<{ id: string; name: string; slug: string }>;

  const now = new Date();
  const summary: Record<string, { published: number; failed: number; skipped: number }> = {};

  for (const tenant of eligible) {
    const counts = { published: 0, failed: 0, skipped: 0 };
    summary[tenant.id] = counts;

    const { data: posts, error: pErr } = await admin
      .from('creative_posts')
      .select('id, tenant_id, title, scheduled_date, scheduled_time, publish_attempts')
      .eq('tenant_id', tenant.id)
      .eq('platform', 'instagram')
      .eq('status', 'approved')
      .in('publish_state', ['idle', 'queued', 'failed'])
      .is('ig_media_id', null)
      .not('scheduled_date', 'is', null)
      .order('scheduled_date', { ascending: true })
      .limit(50);

    if (pErr) {
      console.error('[cron/publish-scheduled] fetch', tenant.id, pErr.message);
      continue;
    }

    const due = ((posts ?? []) as DuePost[])
      .filter((p) => isDue(p, now))
      .filter((p) => Number(p.publish_attempts ?? 0) < MAX_ATTEMPTS)
      .slice(0, MAX_POSTS_PER_RUN);

    for (const post of due) {
      try {
        const res = await publishInstagramPostCore(admin, tenant.id, post.id);

        if (res.success) {
          counts.published++;

          await admin.from('notifications').insert({
            tenant_id: tenant.id,
            user_id: null,
            sender_name: 'Mono AI',
            message: `"${post.title ?? 'Gönderi'}" Instagram'da yayınlandı.`,
            type: 'info',
            is_read: false,
          });

          try {
            await sendPushToTenant(admin, tenant.id, {
              title: 'Instagram gönderisi yayınlandı',
              body: post.title ?? 'Planlanan gönderi yayına alındı.',
              url: '/instagram',
            });
          } catch (e) {
            console.error('[cron/publish-scheduled] push', e);
          }
        } else {
          counts.failed++;
          console.error('[cron/publish-scheduled]', tenant.id, post.id, res.error);

          // Only bother a human once the post has exhausted its retries.
          if (Number(post.publish_attempts ?? 0) + 1 >= MAX_ATTEMPTS) {
            await admin.from('notifications').insert({
              tenant_id: tenant.id,
              user_id: null,
              sender_name: 'Mono AI',
              message: `"${post.title ?? 'Gönderi'}" yayınlanamadı: ${res.error}`,
              type: 'alert',
              is_read: false,
            });
          }
        }
      } catch (e) {
        counts.failed++;
        console.error('[cron/publish-scheduled] unhandled', tenant.id, post.id, e);
      }
    }

    counts.skipped = (posts?.length ?? 0) - due.length;
  }

  return NextResponse.json({
    ok: true,
    tenants: eligible.length,
    summary,
  });
}
