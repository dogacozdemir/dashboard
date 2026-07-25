import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mediaTypeForUrl, MAX_IMAGE_BYTES, MAX_IMAGE_EDGE_PX } from '@/lib/ai/vision';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const action = read('features/creative-studio/actions/reviewCreativeVisually.ts');
const migration = read('supabase/migrations/20260713120000_creative_vision_reviews.sql');

describe('mediaTypeForUrl', () => {
  it('resolves the formats Claude accepts', () => {
    expect(mediaTypeForUrl('https://x/y/a.png')).toBe('image/png');
    expect(mediaTypeForUrl('https://x/y/a.jpg')).toBe('image/jpeg');
    expect(mediaTypeForUrl('https://x/y/a.jpeg')).toBe('image/jpeg');
    expect(mediaTypeForUrl('https://x/y/a.gif')).toBe('image/gif');
    expect(mediaTypeForUrl('https://x/y/a.webp')).toBe('image/webp');
  });

  it('sees through a presigned query string', () => {
    expect(mediaTypeForUrl('https://b.s3.amazonaws.com/k/shot.PNG?X-Amz-Signature=abc')).toBe(
      'image/png',
    );
  });

  it('returns null for a format that cannot be sent', () => {
    expect(mediaTypeForUrl('https://x/y/clip.mp4')).toBeNull();
    expect(mediaTypeForUrl('https://x/y/doc.pdf')).toBeNull();
    expect(mediaTypeForUrl('https://x/y/noext')).toBeNull();
  });
});

describe('vision provider is optional', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  async function load() {
    return (await import('@/lib/ai/vision')).isVisionConfigured;
  }

  it('reports unconfigured when the key is absent', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await load())()).toBe(false);
  });

  it('treats a blank key as unconfigured', async () => {
    process.env.ANTHROPIC_API_KEY = '   ';
    expect((await load())()).toBe(false);
  });

  it('reports configured once a key is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect((await load())()).toBe(true);
  });
});

/**
 * A vision call costs real tokens on every run, so the guards that keep it from
 * firing needlessly — or firing on the wrong media — matter as much as the call.
 */
describe('review guards', () => {
  it('degrades instead of throwing when unconfigured', () => {
    expect(action).toContain('if (!isVisionConfigured())');
    expect(action).toContain('unconfigured: true');
  });

  it('only sends still images, never video', () => {
    expect(action).toContain("post.slides\n    .filter((s) => s.type === 'image')");
  });

  it('caps how many slides go in one review', () => {
    expect(action).toContain('MAX_SLIDES');
    expect(action).toMatch(/slice\(0, MAX_SLIDES\)/);
  });

  it('caches against the exact slide set it judged', () => {
    // Re-uploading media must not leave a stale verdict attached to new artwork.
    expect(action).toContain('function fingerprintSlides');
    expect(action).toContain("eq('slide_fingerprint', fingerprint)");
    expect(migration).toContain('unique (post_id, slide_fingerprint)');
  });

  it('lets the user force a fresh review', () => {
    expect(action).toContain('options?.force');
  });

  it('grounds the critique in the brand vault', () => {
    expect(action).toContain('retrieveBrandVaultContext');
  });

  it('refuses to invent findings', () => {
    expect(action).toMatch(/Yalnızca GÖRSELDE gerçekten gördüğünü söyle/);
    expect(action).toMatch(/sorun uydurma/);
  });

  it('is permission-gated and tenant-scoped', () => {
    expect(action).toContain('requireTenantAction(companyId)');
    expect(action).toContain("requirePermission('creative.comment')");
  });
});

describe('model configuration', () => {
  it('uses the configurable vision model', () => {
    // Defaults to Haiku 4.5 (vision-capable, ~5x cheaper), env-overridable.
    expect(action).toContain('model: visionModel()');
  });

  it('constrains the response to a schema rather than parsing prose', () => {
    expect(action).toContain('zodOutputFormat(reviewSchema)');
    expect(action).toContain('output_config:');
    // Haiku 4.5 rejects adaptive thinking — the call must not send it.
    expect(action).not.toContain("thinking: { type: 'adaptive' }");
  });

  it('keeps the image limits aligned with the model', () => {
    expect(MAX_IMAGE_EDGE_PX).toBe(1568);
    expect(MAX_IMAGE_BYTES).toBeLessThan(5_000_000);
  });
});

describe('review storage', () => {
  it('is tenant-isolated', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('creative_vision_reviews_tenant_isolation');
  });

  it('constrains the verdict to the three the UI renders', () => {
    expect(migration).toMatch(/verdict in \('ready', 'minor_issues', 'needs_work'\)/);
  });
});
