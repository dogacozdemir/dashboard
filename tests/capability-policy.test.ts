import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAPABILITY_POLICY, CAPABILITY_POLICY_EN } from '@/features/ai-chat/prompts/system';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

/**
 * The capability policy is what MonoAI answers "what can you do?" with. If a
 * tool or a write action ships without updating it, the assistant starts either
 * hiding a real feature or claiming one it doesn't have. These tests fail loudly
 * in that case rather than letting the prompt quietly drift.
 */
describe('capability policy stays in sync with the code', () => {
  it('covers every registered tool', () => {
    const registry = read('features/ai-chat/tools/registry.ts');
    const registered = [...registry.matchAll(/^\s{2}(\w+Tool),$/gm)].map((m) => m[1]);

    // Adding a tool without extending the policy should break this.
    expect(registered.sort()).toEqual(
      [
        'assetSearchTool',
        'crawlUrlTool',
        'getCalendarTool',
        'getCompetitorsTool',
        'getCreativeContextTool',
        'getPerformanceTool',
        'getSiteAnalyticsTool',
        'webFetchTool',
        'webSearchTool',
      ].sort(),
    );
  });

  it('covers every proposable write action', () => {
    const source = read('features/ai-chat/actions/proposedActions.ts');
    const kindLine = source.match(/export type ProposedActionKind =([^;]+);/);
    expect(kindLine).not.toBeNull();

    const kinds = [...(kindLine?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(kinds.sort()).toEqual(['approve_creative', 'publish_post', 'request_revision', 'sync_data']);
  });
});

describe('capability policy content', () => {
  for (const [name, policy] of [
    ['tr', CAPABILITY_POLICY],
    ['en', CAPABILITY_POLICY_EN],
  ] as const) {
    describe(name, () => {
      it('states the read capabilities', () => {
        expect(policy).toMatch(/ROAS/);
        expect(policy).toMatch(/GA4/);
        expect(policy).toMatch(/Search Console/);
        expect(policy).toMatch(/Brand Vault|Marka Kasası/);
      });

      it('is explicit that the chat layer cannot see images', () => {
        expect(policy).toMatch(/GÖREMEZSİN|cannot see images in chat/);
      });

      it('points at the vision review instead of dead-ending on "I cannot see"', () => {
        // A creative agency's assistant refusing every design question was the
        // gap; a separate vision model now handles artwork critique.
        expect(policy).toMatch(/AI Görsel İncelemesi|AI Visual Review/);
        expect(policy).toMatch(/göremiyorum" deyip bırakma|don't just say you can't see it/);
      });

      it('rules out writing to ad platforms', () => {
        expect(policy).toMatch(/bütçe değiştiremez|cannot launch ads/);
      });

      it('states that publishing is possible but confirmation-gated', () => {
        expect(policy).toMatch(/YAYINLAMAYI|publishing an approved/);
        expect(policy).toMatch(/geri alınamaz|irreversible/);
      });

      it('rules out cross-tenant access', () => {
        expect(policy).toMatch(/tenant/i);
      });

      it('frames write actions as proposals requiring confirmation', () => {
        expect(policy).toMatch(/onay|confirm/i);
      });

      it('rebuts the "I cannot browse" misconception the model defaults to', () => {
        // MonoAI repeatedly refused live crawls it can actually perform, because
        // the tool policy tells it not to emit function calls. Pin the rebuttal.
        expect(policy).toMatch(/Canlı internet taraması yapamıyorum" DEME|never say "I cannot browse/);
      });

      it('explains that tools run server-side on its behalf', () => {
        expect(policy).toMatch(/sistem bunu senin\s*\n?\s*adına çalıştırır|the system\s*\n?\s*runs it for you/);
      });

      it('forbids inventing data for unconnected sources', () => {
        expect(policy).toMatch(/uyduramazsın|cannot invent data/);
      });
    });
  }
});

describe('policy is actually wired into the prompt', () => {
  it('is included for both locales', () => {
    const source = read('features/ai-chat/prompts/system.ts');
    const builder = source.slice(source.indexOf('export function buildFullSystemPrompt'));
    expect(builder).toContain('CAPABILITY_POLICY_EN');
    expect(builder).toContain('CAPABILITY_POLICY,');
  });
});
