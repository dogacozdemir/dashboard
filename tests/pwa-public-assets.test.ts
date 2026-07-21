import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const proxySource = readFileSync(resolve(process.cwd(), 'proxy.ts'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public/manifest.json'), 'utf8')) as {
  icons?: Array<{ src: string; purpose?: string }>;
};

/**
 * The PWA shell must reach the browser unauthenticated. A service worker script
 * answered with a 307 to /login is rejected by the browser outright, which takes
 * offline support and push notifications down with it — silently.
 */
describe('PWA shell is publicly reachable', () => {
  const shellFiles = ['/sw.js', '/offline.html', '/manifest.json'];

  it('bypasses the auth check at runtime', () => {
    const assetList = proxySource.slice(
      proxySource.indexOf('PUBLIC_ASSET_PATHS'),
      proxySource.indexOf('function isPublicPath'),
    );
    for (const file of shellFiles) {
      expect(assetList, `${file} missing from PUBLIC_ASSET_PATHS`).toContain(`'${file}'`);
    }
  });

  it('is excluded from the middleware matcher', () => {
    const matcher = proxySource.slice(proxySource.indexOf('matcher: ['));
    for (const file of shellFiles) {
      const escaped = file.replace('/', '').replace('.', '\\\\.');
      expect(matcher, `${file} missing from matcher exclusions`).toContain(escaped);
    }
  });
});

/**
 * Schedulers authenticate with a CRON_SECRET bearer token and carry no session
 * cookie. If the proxy guards these paths, every scheduled run is answered with
 * a 307 to /login and the job silently never executes — no sync, no digest, no
 * anomaly alerts, and nothing in the logs to say so.
 */
describe('cron endpoints bypass the session proxy', () => {
  it('is listed as a public path', () => {
    const publicPaths = proxySource.slice(
      proxySource.indexOf('const PUBLIC_PATHS'),
      proxySource.indexOf('const PUBLIC_ASSET_PATHS'),
    );
    expect(publicPaths).toContain("'/api/cron'");
  });

  it('is excluded from the middleware matcher', () => {
    const matcher = proxySource.slice(proxySource.indexOf('matcher: ['));
    expect(matcher).toContain('api/cron');
  });
});

describe('manifest icons', () => {
  it('declares both maskable sizes so installed icons are not letterboxed', () => {
    const maskable = (manifest.icons ?? []).filter((i) => i.purpose === 'maskable');
    expect(maskable.map((i) => i.src).sort()).toEqual([
      '/icon-maskable-192.png',
      '/icon-maskable-512.png',
    ]);
  });

  it('serves every referenced icon through the proxy image bypass', () => {
    // The proxy lets any image extension through; this pins that assumption.
    const imageBypass = /\\\.\(\?:svg\|png\|jpg\|jpeg\|gif\|webp\)\$/;
    expect(proxySource).toMatch(imageBypass);
    for (const icon of manifest.icons ?? []) {
      expect(icon.src).toMatch(/\.(svg|png|jpg|jpeg|gif|webp)$/i);
    }
  });
});
