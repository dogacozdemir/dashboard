'use server';

import type { UserLocale } from '@/types/user';

export interface MonoWelcomeCopy {
  sector: string;
  headline: string;
  subline: string;
}

const FALLBACK_TR: MonoWelcomeCopy = {
  sector: 'Reklam ve Büyüme',
  headline: 'Brand Mono hazır.',
  subline:
    'Sisteminiz şu an sektör verilerinizi analiz etmek ve GEO / performans katmanlarını açmak için hazırlanıyor.',
};

const FALLBACK_EN: MonoWelcomeCopy = {
  sector: 'Advertising & Growth',
  headline: 'Brand Mono is ready.',
  subline:
    'Your workspace is preparing to analyze sector data and unlock GEO / performance layers.',
};

export async function fetchMonoWelcomeCopy(params: {
  tenantName: string;
  userFirstName: string;
  industryHint?: string | null;
  locale: UserLocale;
}): Promise<MonoWelcomeCopy> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const isEn = params.locale === 'en';
  if (!apiKey) return personalizedFallback(params);

  const hint =
    params.industryHint?.trim() ||
    (isEn ? 'general brand and marketing' : 'genel marka ve pazarlama');

  const systemPrompt = isEn
    ? `You are MonoAI, Madmonos agency voice: premium, frictionless, engineering-heavy. Reply ONLY valid JSON with keys: sector (short English sector label, 2-4 words), headline (one punchy English sentence, max 12 words), subline (one English sentence, personalized, mentions data sync / analysis, max 28 words). No markdown.`
    : `You are MonoAI, Madmonos agency voice: premium, frictionless, engineering-heavy. Reply ONLY valid JSON with keys: sector (short Turkish sector label, 2-4 words), headline (one punchy Turkish sentence, max 12 words), subline (one Turkish sentence, personalized, mentions data sync / analysis, max 28 words). No markdown.`;

  const userPrompt = isEn
    ? `User first name: ${params.userFirstName}. Brand / tenant: ${params.tenantName}. Industry hint: ${hint}. Produce welcome copy.`
    : `Kullanıcı adı: ${params.userFirstName}. Marka / tenant: ${params.tenantName}. Sektör ipucu: ${hint}. Karşılama metni üret.`;

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.6,
        max_tokens: 320,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!res.ok) return personalizedFallback(params);

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) return personalizedFallback(params);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as Partial<MonoWelcomeCopy>;
    if (!parsed.headline || !parsed.subline) return personalizedFallback(params);

    const base = isEn ? FALLBACK_EN : FALLBACK_TR;
    return {
      sector: typeof parsed.sector === 'string' ? parsed.sector : base.sector,
      headline: parsed.headline,
      subline: parsed.subline,
    };
  } catch {
    return personalizedFallback(params);
  }
}

function personalizedFallback(params: {
  tenantName: string;
  userFirstName: string;
  locale: UserLocale;
}): MonoWelcomeCopy {
  if (params.locale === 'en') {
    return {
      ...FALLBACK_EN,
      headline: `Hello, ${params.userFirstName}.`,
      subline: `${params.tenantName}: your workspace is preparing to analyze ${FALLBACK_EN.sector.toLowerCase()} signals — your dashboard will light up as integrations finish.`,
    };
  }
  return {
    ...FALLBACK_TR,
    headline: `Merhaba, ${params.userFirstName}.`,
    subline: `${params.tenantName} için sistem şu an ${FALLBACK_TR.sector} verilerini analiz etmek üzere hazırlanıyor — entegrasyonlar tamamlandıkça panonuz canlanacak.`,
  };
}
