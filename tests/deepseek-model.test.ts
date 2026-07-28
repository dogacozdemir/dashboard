import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { describe, expect, it, afterEach } from 'vitest';

/**
 * DeepSeek dropped the `deepseek-chat` alias (calls now 400), which surfaced to
 * users as a misleading "add your API key" empty state. The model name lives in
 * one env-driven helper; these guards keep the stale literal from creeping back
 * into the app code and pin the helper's behaviour.
 */

const root = process.cwd();

describe('deepseekChatModel helper', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  async function load() {
    return (await import('@/lib/ai/deepseek-model')).deepseekChatModel;
  }

  it('defaults to a current, supported model name', async () => {
    delete process.env.DEEPSEEK_MODEL;
    const model = (await load())();
    expect(model).toBe('deepseek-v4-pro');
    expect(model).not.toBe('deepseek-chat');
  });

  it('honours the DEEPSEEK_MODEL override (e.g. the cheaper flash tier)', async () => {
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
    expect((await load())()).toBe('deepseek-v4-flash');
  });

  it('ignores an empty override', async () => {
    process.env.DEEPSEEK_MODEL = '   ';
    expect((await load())()).toBe('deepseek-v4-pro');
  });
});

describe('deepseekFastModel helper', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  async function loadFast() {
    return (await import('@/lib/ai/deepseek-model')).deepseekFastModel;
  }

  it('defaults to the fast flash tier for latency-sensitive UI calls', async () => {
    delete process.env.DEEPSEEK_FAST_MODEL;
    expect((await loadFast())()).toBe('deepseek-v4-flash');
  });

  it('honours the DEEPSEEK_FAST_MODEL override', async () => {
    process.env.DEEPSEEK_FAST_MODEL = 'deepseek-v4-pro';
    expect((await loadFast())()).toBe('deepseek-v4-pro');
  });
});

describe('no stale deepseek-chat literal in app code', () => {
  const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'monoAI', 'coverage']);

  function* walk(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (SKIP_DIRS.has(name)) continue;
      const st = statSync(full);
      if (st.isDirectory()) yield* walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) yield full;
    }
  }

  it('never hardcodes the deprecated model name', () => {
    const offenders: string[] = [];
    for (const dir of ['features', 'lib', 'app']) {
      for (const file of walk(join(root, dir))) {
        if (readFileSync(file, 'utf8').includes("'deepseek-chat'")) {
          offenders.push(file.replace(root + '/', ''));
        }
      }
    }
    expect(offenders, `use deepseekChatModel() instead: ${offenders.join(', ')}`).toEqual([]);
  });
});
