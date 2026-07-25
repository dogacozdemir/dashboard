import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractDocumentTitle, stripPreamble } from '@/features/ai-chat/lib/document-title';
import {
  DELIVERABLE_QUALITY_POLICY,
  DELIVERABLE_QUALITY_POLICY_EN,
} from '@/features/ai-chat/prompts/system';

/** The exact reply that produced a PDF titled with the assistant's small talk. */
const REAL_REPLY = `Tabii ki, performans metriklerinizi PDF olarak hazırlayıp sunuyorum.

Madmonos Lux Cosmetics - Performans Özeti (Simüle Edilmiş, Son 14 Gün)

## Ücretli Medya
- **Meta:** Harcama ~5.840 (simüle)`;

describe('extractDocumentTitle', () => {
  it('never titles a document with the assistant preamble', () => {
    const title = extractDocumentTitle(REAL_REPLY, 'performans raporu ver');
    expect(title).not.toMatch(/^Tabii ki/i);
    expect(title).toContain('Madmonos Lux Cosmetics');
  });

  it('prefers a real markdown heading', () => {
    const title = extractDocumentTitle('# Q3 Büyüme Analizi\n\nGövde metni burada.', 'x');
    expect(title).toBe('Q3 Büyüme Analizi');
  });

  it('skips a heading that is itself a preamble', () => {
    const content = '# Elbette, işte raporunuz\n\n## Gerçek Başlık\n\nGövde.';
    expect(extractDocumentTitle(content, 'x')).toBe('Gerçek Başlık');
  });

  it('rejects English preambles too', () => {
    const content = "Certainly! Here's the report you asked for.\n\nQ4 Channel Performance Review\n";
    expect(extractDocumentTitle(content, 'x')).toBe('Q4 Channel Performance Review');
  });

  it('rejects first-person delivery narration', () => {
    const content = 'Raporu hazırladım.\n\nMarka Görünürlük Analizi\n';
    expect(extractDocumentTitle(content, 'x')).toBe('Marka Görünürlük Analizi');
  });

  it('ignores bullets and numbered lines as title candidates', () => {
    const content = '- ilk madde burada uzun\n1. numaralı madde burada\nAsıl Belge Başlığı\n';
    expect(extractDocumentTitle(content, 'x')).toBe('Asıl Belge Başlığı');
  });

  it('falls back to the user request when the body offers nothing', () => {
    expect(extractDocumentTitle('Tabii ki.', 'Ocak ayı SEO raporu')).toBe('Ocak ayı SEO raporu');
  });

  it('falls back to a branded default when even the request is small talk', () => {
    expect(extractDocumentTitle('Tabii ki.', 'tabii ki')).toBe('Madmonos Raporu');
  });

  it('strips markdown emphasis from the chosen title', () => {
    expect(extractDocumentTitle('# **Kalın Başlık**\n\nGövde.', 'x')).toBe('Kalın Başlık');
  });
});

describe('stripPreamble', () => {
  it('removes the opening pleasantry from the document body', () => {
    const out = stripPreamble(REAL_REPLY);
    expect(out).not.toMatch(/^Tabii ki/i);
    expect(out.startsWith('Madmonos Lux Cosmetics')).toBe(true);
  });

  it('keeps a body that opens with a heading untouched', () => {
    const content = '# Rapor\n\nGövde metni.';
    expect(stripPreamble(content)).toBe(content);
  });

  it('never strips the document down to nothing', () => {
    const onlyPreamble = 'Tabii ki, hazırlıyorum.';
    expect(stripPreamble(onlyPreamble)).toBe(onlyPreamble);
  });

  it('drops several stacked preamble lines', () => {
    const content = 'Elbette.\nHemen hazırlıyorum.\n\nGerçek İçerik Başlıyor Burada\n';
    expect(stripPreamble(content).startsWith('Gerçek İçerik')).toBe(true);
  });
});

describe('PDF renderer defects that reached a client document', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'features/ai-chat/tools/generate-pdf.ts'),
    'utf8',
  );

  it('strips the list marker without eating bold emphasis', () => {
    // `^[\s\-*+]+` also consumed the "**" of "- **Meta:** …", printing a stray "**".
    expect(source).not.toContain('replace(/^[\\s\\-*+]+/');
    expect(source).toContain("replace(/^\\s*(?:[-+•]|\\*(?!\\*))\\s+/, '')");
  });

  it('substitutes the lira sign the embedded font cannot render', () => {
    // Liberation Sans has no U+20BA, so ₺ printed as a blank box.
    expect(source).toContain('function normalizeLira');
    expect(source).toContain("replace(/₺\\s*/g, 'TL ')");
  });

  it('keeps typography intact when the Unicode fonts are embedded', () => {
    expect(source).toContain('if (unicodeFontsActive)');
  });

  it('prints the Madmonos wordmark as letterhead', () => {
    expect(source).toContain("drawText('madmonos'");
    expect(source).toContain('monoAI RAPORU');
  });

  it('does not repeat the cover title as the first body heading', () => {
    expect(source).toContain("allBlocks[firstContent].type === 'h1'");
  });
});

describe('deliverable quality policy', () => {
  for (const [name, policy] of [
    ['tr', DELIVERABLE_QUALITY_POLICY],
    ['en', DELIVERABLE_QUALITY_POLICY_EN],
  ] as const) {
    describe(name, () => {
      it('bans the conversational opener', () => {
        expect(policy).toMatch(/Tabii ki|Certainly/);
        expect(policy).toMatch(/ASLA|Never/);
      });

      it('requires an executive summary and recommended actions', () => {
        expect(policy).toMatch(/Yönetici Özeti|Executive Summary/);
        expect(policy).toMatch(/Önerilen Aksiyonlar|Recommended Actions/);
      });

      it('demands interpretation, not just numbers', () => {
        expect(policy).toMatch(/Ne anlama geliyor|What it means/);
      });

      it('requires numbers to carry context', () => {
        expect(policy).toMatch(/ROAS 3\.2x/);
      });

      it('forbids inventing data for unconnected channels', () => {
        expect(policy).toMatch(/uydurma|Never invent data/);
      });
    });
  }

  it('is wired into both locales of the system prompt', () => {
    const prompt = readFileSync(
      resolve(process.cwd(), 'features/ai-chat/prompts/system.ts'),
      'utf8',
    );
    const builder = prompt.slice(prompt.indexOf('export function buildFullSystemPrompt'));
    expect(builder).toContain('DELIVERABLE_QUALITY_POLICY_EN');
    expect(builder).toContain('DELIVERABLE_QUALITY_POLICY,');
  });
});
