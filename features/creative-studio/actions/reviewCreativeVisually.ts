'use server';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { requirePermission } from '@/lib/auth/permissions';
import { auth } from '@/lib/auth/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { retrieveBrandVaultContext } from '@/features/ai-chat/lib/retrieveBrandRag';
import { fetchImageForVision, getVisionClient, isVisionConfigured, visionModel } from '@/lib/ai/vision';
import { fetchCreativePosts } from './fetchAssets';
import type { SessionUser } from '@/types/user';

/** Max slides sent per review — each image costs tokens and adds latency. */
const MAX_SLIDES = 4;

const reviewSchema = z.object({
  verdict: z
    .enum(['ready', 'minor_issues', 'needs_work'])
    .describe('Overall call: ready to publish, small fixes, or needs rework.'),
  summary: z.string().describe('Two or three sentences a client could read verbatim.'),
  strengths: z.array(z.string()).describe('What genuinely works. Empty if nothing does.'),
  findings: z
    .array(
      z.object({
        area: z.enum([
          'brand_consistency',
          'legibility',
          'composition',
          'text_ratio',
          'accessibility',
          'platform_fit',
          'message_clarity',
        ]),
        severity: z.enum(['low', 'medium', 'high']),
        note: z.string().describe('What is wrong, stated concretely.'),
        suggestion: z.string().describe('The specific change to make.'),
      }),
    )
    .describe('Concrete issues. Empty array when the creative is clean.'),
});

export type CreativeVisionReview = z.infer<typeof reviewSchema> & {
  model: string | null;
  createdAt: string;
};

export type ReviewResult =
  | { success: true; review: CreativeVisionReview; cached: boolean }
  | { success: false; error: string; unconfigured?: boolean };

/** Reviews are cached against the exact slide set they judged. */
function fingerprintSlides(urls: string[]): string {
  const keys = urls.map((u) => u.split('?')[0]).sort();
  return createHash('sha256').update(keys.join('|')).digest('hex').slice(0, 32);
}

function buildSystemPrompt(brandContext: string | null): string {
  return [
    'Sen Madmonos ajansında kıdemli bir sanat yönetmenisin. Bir sosyal medya kreatifini',
    'yayına çıkmadan önce inceliyorsun. Değerlendirmen müşteriye gösterilecek.',
    '',
    'Neye bakacaksın:',
    '- Marka tutarlılığı: renk, tipografi, logo kullanımı marka kılavuzuna uyuyor mu?',
    '- Okunabilirlik: metin küçük ekranda okunuyor mu? Kontrast yeterli mi?',
    '- Kompozisyon: hiyerarşi net mi? Önemli öğeler kırpılma alanına taşıyor mu?',
    '- Metin oranı: görselin çok fazlası metinle mi kaplı? (Meta reklamlarında sorun yaratır.)',
    '- Erişilebilirlik: renk körlüğü ve düşük kontrast açısından.',
    '- Platform uyumu: Instagram feed/reel formatına uygun mu?',
    '- Mesaj netliği: bir saniyede ne anlatıldığı anlaşılıyor mu?',
    '',
    'Kurallar:',
    '- Yalnızca GÖRSELDE gerçekten gördüğünü söyle. Emin değilsen o bulguyu yazma.',
    '- Her bulgu somut ve uygulanabilir olmalı ("kontrast düşük" değil,',
    '  "beyaz başlık açık gri zeminde okunmuyor — zemini koyulaştır veya metni koyu yap").',
    '- Kreatif iyiyse bunu söyle; sorun uydurma. findings boş dizi olabilir.',
    '- Türkçe yaz.',
    brandContext ? `\nMarka kılavuzu (Marka Kasası'ndan):\n${brandContext}` : '',
  ].join('\n');
}

/**
 * Looks at the actual artwork and returns a structured critique.
 *
 * This is the one MonoAI capability that cannot run on the chat model: DeepSeek
 * is text-only, so creative review has always been limited to reading titles and
 * comments. Results are cached per slide set — a review costs real tokens.
 */
export async function reviewCreativeVisually(
  companyId: string,
  postId: string,
  options?: { force?: boolean },
): Promise<ReviewResult> {
  const validatedId = await requireTenantAction(companyId);
  await requirePermission('creative.comment');

  if (!isVisionConfigured()) {
    return {
      success: false,
      unconfigured: true,
      error: 'Görsel inceleme bu ortamda yapılandırılmadı (ANTHROPIC_API_KEY eksik).',
    };
  }

  const supabase = await createSupabaseServerClient();

  const posts = await fetchCreativePosts(validatedId);
  const post = posts.find((p) => p.id === postId);
  if (!post) return { success: false, error: 'Kreatif bulunamadı.' };

  // Only still images can be judged; a video's frames are out of scope here.
  const imageSlides = post.slides
    .filter((s) => s.type === 'image')
    .slice(0, MAX_SLIDES);

  if (imageSlides.length === 0) {
    return { success: false, error: 'Bu gönderide incelenebilecek bir görsel yok.' };
  }

  const fingerprint = fingerprintSlides(imageSlides.map((s) => s.url));

  if (!options?.force) {
    const { data: cached } = await supabase
      .from('creative_vision_reviews')
      .select('verdict, summary, findings, strengths, model, created_at')
      .eq('tenant_id', validatedId)
      .eq('post_id', postId)
      .eq('slide_fingerprint', fingerprint)
      .maybeSingle();

    if (cached) {
      const row = cached as Record<string, unknown>;
      return {
        success: true,
        cached: true,
        review: {
          verdict: row.verdict as CreativeVisionReview['verdict'],
          summary: String(row.summary ?? ''),
          findings: (row.findings ?? []) as CreativeVisionReview['findings'],
          strengths: (row.strengths ?? []) as string[],
          model: (row.model as string | null) ?? null,
          createdAt: String(row.created_at),
        },
      };
    }
  }

  const images = (
    await Promise.all(imageSlides.map((s) => fetchImageForVision(s.url)))
  ).filter((i): i is NonNullable<typeof i> => i !== null);

  if (images.length === 0) {
    return { success: false, error: 'Görseller indirilemedi; tekrar deneyin.' };
  }

  // Ground the critique in the brand's own guidelines when they exist.
  let brandContext: string | null = null;
  try {
    brandContext = await retrieveBrandVaultContext(
      supabase,
      validatedId,
      'marka kılavuzu renk tipografi logo kullanımı ton',
    );
  } catch {
    brandContext = null;
  }

  const client = getVisionClient();
  if (!client) return { success: false, unconfigured: true, error: 'Görsel inceleme yapılandırılmadı.' };

  const caption = post.caption?.trim();
  const promptText = [
    `Kreatif başlığı: ${post.title}`,
    `Platform: ${post.platform ?? 'instagram'} · Format: ${post.contentFormat}`,
    caption ? `Açıklama metni: ${caption}` : 'Açıklama metni girilmemiş.',
    imageSlides.length > 1 ? `${images.length} slayt inceleniyor (carousel).` : '',
    '',
    'Bu kreatifi yukarıdaki kriterlere göre incele.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await client.messages.parse({
      // No thinking param: structured critique doesn't need it, and adaptive
      // thinking 400s on Haiku 4.5 (the default model).
      model: visionModel(),
      max_tokens: 4096,
      system: buildSystemPrompt(brandContext),
      output_config: { format: zodOutputFormat(reviewSchema) },
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 },
            })),
            { type: 'text' as const, text: promptText },
          ],
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return { success: false, error: 'İnceleme sonucu okunamadı, tekrar deneyin.' };
    }

    const session = await auth();
    const userId = (session?.user as SessionUser | undefined)?.id ?? null;

    const review: CreativeVisionReview = {
      ...parsed,
      model: response.model,
      createdAt: new Date().toISOString(),
    };

    const { error: saveErr } = await supabase.from('creative_vision_reviews').upsert(
      {
        tenant_id: validatedId,
        post_id: postId,
        slide_fingerprint: fingerprint,
        verdict: review.verdict,
        summary: review.summary,
        findings: review.findings,
        strengths: review.strengths,
        model: review.model,
        created_by: userId,
      },
      { onConflict: 'post_id,slide_fingerprint' },
    );
    if (saveErr) console.error('[reviewCreativeVisually] cache write', saveErr.message);

    return { success: true, cached: false, review };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[reviewCreativeVisually]', msg);
    return { success: false, error: 'Görsel inceleme tamamlanamadı. Lütfen tekrar deneyin.' };
  }
}
