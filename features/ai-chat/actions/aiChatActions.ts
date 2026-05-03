'use server';

import { getPremiumActionError } from '@/lib/copy/premium-copy';
import { createSupabaseServerClient }   from '@/lib/supabase/server';
import { requireTenantAction }          from '@/lib/auth/tenant-guard';
import { requirePermission }            from '@/lib/auth/permissions';
import { auth }                         from '@/lib/auth/config';
import { buildFullSystemPrompt, buildMemorySummarizerPrompt } from '../prompts/system';
import { shouldSearchBrandVault } from '../lib/brandRagIntent';
import { retrieveBrandVaultContext } from '../lib/retrieveBrandRag';
import { generateAndStorePdf }          from '../tools/generate-pdf';
import { webSearchTool }               from '../tools/web-search';
import { assetSearchTool }             from '../tools/asset-search';
import type { AiMessage }               from '../types';
import type { DeepSeekMessage, DeepSeekToolCall, ToolContext } from '../tools/types'; // DeepSeekToolCall used by executeToolCalls
import type { SessionUser }             from '@/types/user';
import { trackActivity }                from '@/features/gamification/actions/trackActivity';
import { isDemoTenant }                 from '@/lib/demo/is-demo-tenant';
import { showroomStrategicAppendix }    from '@/lib/demo/showroom-data';
import {
  DEMO_SHOWROOM_APPENDIX_EN,
  DEMO_SHOWROOM_APPENDIX_TR,
} from '@/lib/demo/showroom-ai-appendix';

const DEEPSEEK_URL          = 'https://api.deepseek.com/v1/chat/completions';

// Token budgets — adaptive based on request type
const MAX_TOKENS_CHAT       = 800;   // everyday conversation: fast
const MAX_TOKENS_CHAT_RICH  = 1600;  // conversation + live dashboard appendix
const MAX_TOKENS_RESEARCH   = 2200;  // response that includes web research data
const MAX_TOKENS_DOCUMENT   = 3000;  // PDF / full-document generation

const HISTORY_TURNS = 28;

type RpcAggRowLite = { platform: string; spend: string | number };

/**
 * Rich, tenant-scoped context for strategic answers (performance + last GEO cache).
 * Token cost is intentional for high-ticket B2B quality.
 */
async function fetchTenantStrategicAppendix(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  locale: SessionUser['locale'],
): Promise<string | null> {
  const to    = new Date().toISOString().split('T')[0];
  const fromD = new Date();
  fromD.setDate(fromD.getDate() - 14);
  const from = fromD.toISOString().split('T')[0];

  const lines: string[] = [];

  const { data: rpcData, error: rpcErr } = await supabase.rpc('aggregate_daily_metrics_range', {
    p_tenant_id: tenantId,
    p_from:      from,
    p_to:        to,
  });

  if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
    let total = 0;
    for (const raw of rpcData as RpcAggRowLite[]) {
      const s = Number(raw.spend);
      total += s;
      if (locale === 'en') {
        lines.push(`- ${raw.platform}: spend ~${s.toFixed(2)} (last 14 days, synced data)`);
      } else {
        lines.push(`- ${raw.platform}: harcama ~${s.toFixed(2)} (son 14 gün, senkronize veri)`);
      }
    }
    if (locale === 'en') {
      lines.unshift(
        `Paid media summary (last 14 days): total spend ~${total.toFixed(2)} (currency depends on account settings).`,
      );
    } else {
      lines.unshift(`Paid media özeti (son 14 gün): toplam harcama ~${total.toFixed(2)} (para birimi hesap ayarına bağlı).`);
    }
  }

  const { data: strat } = await supabase
    .from('strategy_logs')
    .select('content')
    .eq('tenant_id', tenantId)
    .eq('report_type', 'geo')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const content = strat?.content as Record<string, unknown> | null | undefined;
  if (content && typeof content === 'object') {
    const head = typeof content.strategicHeadline === 'string' ? content.strategicHeadline : null;
    const sum  = typeof content.strategicSummary === 'string' ? content.strategicSummary : null;
    if (head || sum) {
      if (locale === 'en') {
        lines.push('Latest cached GEO strategy:');
        if (head) lines.push(`- Headline: ${head}`);
        if (sum) {
          const clip = sum.length > 520 ? `${sum.slice(0, 520)}…` : sum;
          lines.push(`- Summary: ${clip}`);
        }
      } else {
        lines.push('Son üretilen GEO strateji önbelleği:');
        if (head) lines.push(`- Başlık: ${head}`);
        if (sum) {
          const clip = sum.length > 520 ? `${sum.slice(0, 520)}…` : sum;
          lines.push(`- Özet: ${clip}`);
        }
      }
    }
  }

  if (!lines.length) return null;
  return lines.join('\n');
}

// Only trigger Tavily when the user explicitly wants EXTERNAL web information.
// Deliberately narrow — internal analysis, campaign questions, asset questions do NOT match.
const RESEARCH_RE = new RegExp(
  [
    'web.*ara',          // web'de ara, web araştır
    'internet.*ara',     // internette araştır
    'araştır',           // piyasa araştır, rakip araştır, araştırma yap
    'market research',   // explicit english
    'piyasa.*araştır',
    'rakip.*araştır',
    'competitor',
    'güncel.*haber',     // güncel haberler
    'son.*haber',        // son haberler
    'news about',
    'what is happening',
    'trend.*araştır',
  ].join('|'),
  'i',
);

// Keywords that trigger proactive asset search
const ASSET_RE    = /creative|asset|kreatif|marka\b|brand|göster|listele|içerik|medya/i;
// Keywords that signal the user wants PDF output
const PDF_REQUEST_RE = /\bpdf\b|raporla|as pdf|pdf olarak|doküman|brief|özet.*kaydet|oluştur.*pdf/i;

// ─── SUMMARY GENERATOR ───────────────────────────────────────────────────────

async function generateConversationSummary(
  apiKey: string,
  tenantName: string,
  olderMessages: Array<{ role: string; content: string }>,
  locale: SessionUser['locale'],
): Promise<string | null> {
  if (olderMessages.length === 0) return null;

  const transcript = olderMessages
    .slice(-120)
    .map((m) => `${m.role === 'assistant' ? 'AI' : 'User'}: ${m.content}`)
    .join('\n');

  const response = await fetch(DEEPSEEK_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:    'deepseek-chat',
      messages: [
        { role: 'system', content: buildMemorySummarizerPrompt(locale) },
        {
          role:    'user',
          content:
            locale === 'en'
              ? `Tenant: ${tenantName}\n\nCompress this transcript:\n\n${transcript}`
              : `Tenant: ${tenantName}\n\nBu dökümü sıkıştır:\n\n${transcript}`,
        },
      ],
      max_tokens:  500,
      temperature: 0.2,
      stream:      false,
    }),
  });

  if (!response.ok) {
    console.error('[summary] DeepSeek error:', await response.text());
    return null;
  }

  const json = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? null;
}

// ─── TOOL CALL EXECUTOR (kept for potential future use) ──────────────────────

async function executeToolCalls(
  toolCalls: DeepSeekToolCall[],
  context: ToolContext,
): Promise<Array<{ tool_call_id: string; content: string }>> {
  const { findTool } = await import('../tools/registry');
  const results: Array<{ tool_call_id: string; content: string }> = [];

  for (const tc of toolCalls) {
    const toolName = tc.function.name;
    const tool     = findTool(toolName);

    if (!tool) {
      results.push({
        tool_call_id: tc.id,
        content:      `Error: Unknown tool "${toolName}". Available tools: generate_pdf, web_fetch, web_search, search_assets.`,
      });
      continue;
    }

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(tc.function.arguments);
    } catch {
      results.push({
        tool_call_id: tc.id,
        content:      `Error: Could not parse arguments for tool "${toolName}".`,
      });
      continue;
    }

    try {
      const result = await tool.execute(args, context);
      results.push({ tool_call_id: tc.id, content: result.content });
    } catch (err) {
      console.error(`[tool:${toolName}] execution error:`, err);
      results.push({
        tool_call_id: tc.id,
        content:
          `Tool "${toolName}" failed unexpectedly: ` +
          (err instanceof Error ? err.message : String(err)),
      });
    }
  }

  return results;
}

// ─── PDF HELPERS ─────────────────────────────────────────────────────────────

function extractDocumentTitle(content: string, fallback: string): string {
  // First markdown heading
  const h = content.match(/^#{1,3}\s+(.+)/m);
  if (h) return h[1].replace(/\*\*/g, '').trim().slice(0, 100);
  // First non-empty, non-bullet line
  const line = content.split('\n').find((l) => l.trim().length > 8 && !l.trim().startsWith('-'));
  if (line) return line.trim().replace(/\*\*/g, '').slice(0, 100);
  return fallback.slice(0, 80);
}

function buildPdfFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöçğüşöçı ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  const date = new Date().toISOString().slice(0, 10);
  return `${slug || 'report'}-${date}.pdf`;
}

// ─── ASYNC SUMMARY REFRESH (non-blocking) ────────────────────────────────────

function refreshSummaryAsync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  apiKey: string,
  tenantName: string,
  tenantId: string,
  prevSummaryCount: number,
  tokensUsed: number,
  locale: SessionUser['locale'],
): void {
  // Intentionally not awaited — runs after response is already returned to the client.
  Promise.resolve().then(async () => {
    try {
      const { data: allHistory } = await supabase
        .from('ai_chat_history')
        .select('role, content, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
        .limit(300);

      const totalCount = allHistory?.length ?? 0;
      if (totalCount <= 24) return;

      const older        = (allHistory as Array<{ role: string; content: string }>)
        .slice(0, Math.max(0, totalCount - 20));
      const olderCount   = older.length;
      const newlyAccrued = Math.max(0, olderCount - prevSummaryCount);

      if (newlyAccrued < 6 && tokensUsed <= 1200) return;

      const summaryText = await generateConversationSummary(apiKey, tenantName, older, locale);
      if (!summaryText) return;

      await supabase.from('ai_chat_summaries').upsert({
        tenant_id:            tenantId,
        summary_text:         summaryText,
        source_message_count: olderCount,
        updated_at:           new Date().toISOString(),
      });
    } catch (err) {
      console.error('[refreshSummaryAsync]', err);
    }
  }).catch(console.error);
}

// ─── PUBLIC ACTIONS ──────────────────────────────────────────────────────────

export async function fetchAiHistory(companyId: string): Promise<AiMessage[]> {
  const validatedId = await requireTenantAction(companyId);
  await requirePermission('ai.mono_chat');
  const supabase    = await createSupabaseServerClient();

  const { data } = await supabase
    .from('ai_chat_history')
    .select('id, role, content, tokens_used, created_at')
    .eq('tenant_id', validatedId)
    .order('created_at', { ascending: true })
    .limit(200);

  return (data ?? []).map((m) => ({
    id:         m.id,
    role:       m.role as AiMessage['role'],
    content:    m.content,
    tokensUsed: m.tokens_used ?? undefined,
    createdAt:  m.created_at,
  }));
}

export async function sendAiMessage(
  companyId:  string,
  userMessage: string,
  tenantName:  string,
): Promise<{ reply: string; error?: string }> {
  const session = await auth();
  if (!session) {
    const { premiumSessionRequiredMessage } = await import('@/lib/i18n/premium-action-errors');
    return { reply: '', error: await premiumSessionRequiredMessage() };
  }

  const user        = session.user as SessionUser;
  const locale      = user.locale;
  const validatedId = await requireTenantAction(companyId);
  await requirePermission('ai.mono_chat');
  const supabase    = await createSupabaseServerClient();
  const apiKey      = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return {
      reply: '',
      error:
        locale === 'en'
          ? 'MonoAI is not configured in this environment yet. Try again after your admin enables it.'
          : 'MonoAI bu ortamda henüz yapılandırılmadı. Yönetici onayından sonra tekrar deneyin.',
    };
  }

  // ── Parallel DB fetches (summary + history + user message insert) ──────────
  const demoTenant = await isDemoTenant(validatedId);

  const [
    { data: summaryRow },
    { data: history },
    strategicAppendix,
  ] = await Promise.all([
    supabase
      .from('ai_chat_summaries')
      .select('summary_text, source_message_count')
      .eq('tenant_id', validatedId)
      .maybeSingle(),
    supabase
      .from('ai_chat_history')
      .select('role, content')
      .eq('tenant_id', validatedId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_TURNS),
    demoTenant
      ? Promise.resolve(showroomStrategicAppendix(locale))
      : fetchTenantStrategicAppendix(supabase, validatedId, locale),
  ]);

  const insertUserRes = await supabase.from('ai_chat_history').insert({
    tenant_id: validatedId,
    user_id:   user.id,
    role:      'user',
    content:   userMessage,
    model:     'deepseek-chat',
  });

  if (insertUserRes.error) {
    console.error('[insert user msg]', insertUserRes.error.message);
  } else {
    try {
      await trackActivity('ai_message_sent');
    } catch (e: unknown) {
      console.error('[trackActivity ai_message_sent]', e);
    }
  }

  const contextMessages: DeepSeekMessage[] = [...(history ?? []).reverse()].map((m) => ({
    role:    m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Build initial message list
  const geoHeader =
    locale === 'en'
      ? '## LIVE PERFORMANCE / GEO SUMMARY (dashboard; this session)'
      : '## CANLI PERFORMANS / GEO ÖZETİ (dashboard; bu oturum)';
  const geoFooter =
    locale === 'en'
      ? 'This block is context only; figures depend on ad sync and cache. If anything is missing, suggest running sync or generating a GEO report.'
      : 'Bu blok yalnızca bağlamdır; rakamlar reklam senkronu ve önbelleğe bağlıdır. Eksikse kullanıcıya senkron veya GEO raporu öner.';

  let systemPromptBody = strategicAppendix
    ? `${buildFullSystemPrompt(tenantName, locale)}\n\n${geoHeader}\n${strategicAppendix}\n\n${geoFooter}`
    : buildFullSystemPrompt(tenantName, locale);

  if (demoTenant) {
    const demoAppend = locale === 'en' ? DEMO_SHOWROOM_APPENDIX_EN : DEMO_SHOWROOM_APPENDIX_TR;
    systemPromptBody = `${systemPromptBody}\n\n${demoAppend}`;
  }

  const systemMessages: DeepSeekMessage[] = [{ role: 'system', content: systemPromptBody }];
  if (summaryRow?.summary_text) {
    systemMessages.push({
      role:    'system',
      content:
        locale === 'en'
          ? `Conversation summary (older context):\n${summaryRow.summary_text}`
          : `Konuşma özeti (eski bağlam):\n${summaryRow.summary_text}`,
    });
  }

  const toolCtx: ToolContext = { tenantId: validatedId };

  let finalReply     = '';
  let tokensUsed: number | undefined;
  const userWantsPdf = PDF_REQUEST_RE.test(userMessage);

  try {
    // ── Phase 1: Proactive tool execution (no DSML / no function-calling) ──
    // We detect intent with simple regexes and run tools directly on the server.
    // Results are injected as plain text into the DeepSeek context.
    // This guarantees the model always receives a text-only conversation and
    // therefore always produces a text reply — no DSML loops possible.
    const toolSnippets: string[] = [];

    if (RESEARCH_RE.test(userMessage)) {
      try {
        const r = await webSearchTool.execute({ query: userMessage, max_results: 5 }, toolCtx);
        if (!r.isError && r.content.trim()) {
          const label =
            locale === 'en' ? '**Web research findings:**' : '**Web Araştırma Bulguları:**';
          toolSnippets.push(`${label}\n${r.content}`);
        }
      } catch (e) {
        console.error('[tool:web_search]', e);
      }
    }

    if (ASSET_RE.test(userMessage)) {
      try {
        const r = await assetSearchTool.execute({ query: userMessage, asset_type: 'all', status: 'all' }, toolCtx);
        if (!r.isError && r.content.trim()) {
          const label = locale === 'en' ? '**Existing assets:**' : '**Mevcut Varlıklar:**';
          toolSnippets.push(`${label}\n${r.content}`);
        }
      } catch (e) {
        console.error('[tool:asset_search]', e);
      }
    }

    if (shouldSearchBrandVault(userMessage)) {
      try {
        const rag = await retrieveBrandVaultContext(supabase, validatedId, userMessage);
        if (rag?.trim()) {
          toolSnippets.push(rag);
        }
      } catch (e) {
        console.error('[tool:brand_rag]', e);
      }
    }

    // ── Phase 2: Single DeepSeek text call — NO tools sent ─────────────────
    // Build a clean, DSML-free conversation. Tool results are plain text.
    const hasResearchData = toolSnippets.length > 0;

    const userTurn: DeepSeekMessage = hasResearchData
      ? locale === 'en'
        ? {
            role:    'user',
            content:
              `Request: ${userMessage}\n\n` +
              `---\nResearch data for this topic:\n\n` +
              toolSnippets.join('\n\n---\n\n') +
              `\n---\n\nWrite a comprehensive, well-formatted answer using the data above.`,
          }
        : {
            role:    'user',
            content:
              `İstek: ${userMessage}\n\n` +
              `---\nAşağıda bu konuyla ilgili araştırma verileri yer alıyor:\n\n` +
              toolSnippets.join('\n\n---\n\n') +
              `\n---\n\nYukarıdaki verileri kullanarak kapsamlı, iyi biçimlendirilmiş bir yanıt yaz.`,
          }
      : { role: 'user', content: userMessage };

    // Adaptive token budget — avoid paying the latency cost of large budgets for simple chat
    const maxTokens = userWantsPdf
      ? MAX_TOKENS_DOCUMENT
      : hasResearchData
        ? MAX_TOKENS_RESEARCH
        : strategicAppendix
          ? MAX_TOKENS_CHAT_RICH
          : MAX_TOKENS_CHAT;

    const synthMessages: DeepSeekMessage[] = [
      ...systemMessages,
      ...contextMessages,
      userTurn,
    ];

    const response = await fetch(DEEPSEEK_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'deepseek-chat',
        messages:    synthMessages,
        max_tokens:  maxTokens,
        temperature: 0.65,
        stream:      false,
        // Intentionally NO tools — forces plain text response, no DSML possible
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[sendAiMessage] DeepSeek error:', errText);
      return { reply: '', error: await getPremiumActionError() };
    }

    const json = await response.json() as {
      choices: Array<{ message: { content: string | null }; finish_reason: string }>;
      usage?: { total_tokens?: number };
    };

    tokensUsed = json.usage?.total_tokens;

    // Strip any DSML the model leaked into content (can happen if context contains prior DSML patterns)
    const rawReply = json.choices[0]?.message?.content ?? '';
    // Find where DSML starts — discard everything from that point
    const dsmlMarker = '\uFF5CDSML\uFF5C';
    const dsmlStart  = rawReply.indexOf('<' + dsmlMarker);
    finalReply = (dsmlStart > 0 ? rawReply.slice(0, dsmlStart) : dsmlStart === 0 ? '' : rawReply).trim();

    if (!finalReply) {
      finalReply =
        locale === 'en'
          ? 'Could not generate a reply. Please try again.'
          : 'Yanıt oluşturulamadı. Lütfen tekrar deneyin.';
    }

    // ── Auto PDF generation ─────────────────────────────────────────────────
    // If the user requested a PDF, we generate it automatically from the final
    // text reply. This is more reliable than asking the model to call generate_pdf
    // with potentially thousands of words of content inside a tool call.
    if (userWantsPdf && finalReply.length > 150) {
      try {
        const title    = extractDocumentTitle(finalReply, userMessage);
        const filename = buildPdfFilename(title);

        const pdfResult = await generateAndStorePdf(
          { filename, title, content: finalReply },
          validatedId,
        );

        const sizeKb = Math.round(pdfResult.sizeBytes / 1024);
        if (locale === 'en') {
          finalReply +=
            `\n\n---\n**PDF ready** · ${filename} · ${sizeKb} KB\n` +
            `**Download:** [${filename}](${pdfResult.downloadUrl})\n` +
            `_(Link valid for 1 hour)_`;
        } else {
          finalReply +=
            `\n\n---\n**PDF hazır** · ${filename} · ${sizeKb} KB\n` +
            `**İndir / Download:** [${filename}](${pdfResult.downloadUrl})\n` +
            `_(Link 1 saat geçerlidir · Link valid for 1 hour)_`;
        }
        try {
          await trackActivity('pdf_generated');
        } catch (e: unknown) {
          console.error('[trackActivity pdf_generated]', e);
        }
      } catch (pdfErr) {
        console.error('[auto-pdf]', pdfErr);
        finalReply +=
          locale === 'en'
            ? '\n\n_(PDF generation failed. Check your AWS S3 configuration.)_'
            : '\n\n_(PDF oluşturulurken bir hata oluştu. AWS S3 yapılandırmanızı kontrol edin.)_';
      }
    }

    // ── Persist assistant reply ─────────────────────────────────────────────
    await supabase.from('ai_chat_history').insert({
      tenant_id:   validatedId,
      user_id:     null,
      role:        'assistant',
      content:     finalReply,
      model:       'deepseek-chat',
      tokens_used: tokensUsed ?? null,
    });

    // ── Refresh long-term summary — fire-and-forget ──────────────────────────
    refreshSummaryAsync(
      supabase,
      apiKey,
      tenantName,
      validatedId,
      summaryRow?.source_message_count ?? 0,
      tokensUsed ?? 0,
      locale,
    );

    return { reply: finalReply };
  } catch (err) {
    console.error('[sendAiMessage]', err);
    return { reply: '', error: await getPremiumActionError() };
  }
}

export async function clearAiHistory(companyId: string): Promise<void> {
  const validatedId = await requireTenantAction(companyId);
  await requirePermission('ai.mono_chat');
  const supabase    = await createSupabaseServerClient();
  await supabase
    .from('ai_chat_history')
    .delete()
    .eq('tenant_id', validatedId);
}
