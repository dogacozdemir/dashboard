import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

/**
 * The product used to speak in agency buzzwords — "Sürtünmesiz Pazarlama
 * Operasyonları", "Engineering Capacity™", "frictionless SSOT". The owner asked
 * for natural, plain language everywhere users read text, so banned phrases are
 * pinned here: reintroducing one fails the build.
 */
const BANNED_IN_UI = [
  'Sürtünmesiz',
  'sürtünmesiz',
  'Frictionless',
  'frictionless',
  'Mühendislik Kapasitesi',
  'Engineering Capacity',
  'güçlendirilmiştir',
  'zekâ katmanı',
  'intelligence layer',
  'SSOT',
  '™',
];

describe('user-facing copy stays in natural language', () => {
  for (const locale of ['tr', 'en']) {
    it(`messages/${locale}.json contains no banned buzzwords`, () => {
      const content = read(`messages/${locale}.json`);
      for (const phrase of BANNED_IN_UI) {
        expect(content, `"${phrase}" found in messages/${locale}.json`).not.toContain(phrase);
      }
    });
  }

  it('the app metadata description is plain', () => {
    const layout = read('app/layout.tsx');
    expect(layout).not.toMatch(/[Ff]rictionless/);
  });

  it('the PDF powered-by line is plain', () => {
    const route = read('app/api/reports/mono-report/route.ts');
    expect(route).not.toContain('intelligence layer');
    expect(route).not.toContain('zekâ katmanı');
  });
});

/**
 * The prompts are upstream of every sentence MonoAI writes. If they instruct
 * the model to use buzzwords, cleaning the UI strings fixes nothing.
 */
describe('AI prompts do not teach buzzwords', () => {
  it('the agency playbook bans hype instead of requiring it', () => {
    const system = read('features/ai-chat/prompts/system.ts');
    expect(system).not.toContain('Terms you should comfortably use: Frictionless');
    expect(system).not.toContain('Terimler: Frictionless');
    expect(system).toMatch(/pazarlama klişelerinden|marketing buzzwords/i);
  });

  it('the welcome-copy voice asks for natural language', () => {
    const welcome = read('features/onboarding/actions/welcomeCopy.ts');
    expect(welcome).not.toContain('frictionless');
    expect(welcome).toContain('no marketing buzzwords');
  });

  it('the report narrative voice asks for natural language', () => {
    const narrative = read('features/mono-report/generateMonoReportNarrative.ts');
    expect(narrative).not.toContain('frictionless');
    expect(narrative).toMatch(/pazarlama klişesi kullanma|no buzzwords/);
  });
});
