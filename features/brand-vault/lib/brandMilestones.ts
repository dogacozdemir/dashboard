import type { BrandAssetType } from '../types';

/** Weighted checklist items — single source for score + UI checklist */
export const BRAND_MILESTONES: ReadonlyArray<{
  type: BrandAssetType;
  points: number;
}> = [
  { type: 'logo', points: 25 },
  { type: 'brand-book', points: 25 },
  { type: 'color-palette', points: 20 },
  { type: 'font', points: 20 },
];

export function isBrandAssetType(v: string): v is BrandAssetType {
  return (
    v === 'logo' ||
    v === 'brand-book' ||
    v === 'font' ||
    v === 'color-palette' ||
    v === 'other'
  );
}

/**
 * Brand Health 0–100: milestone weights + 10pt bonus when vault has 3+ files.
 */
export function computeBrandHealthScore(
  types: Iterable<string>,
  assetCount: number,
): number {
  const set = types instanceof Set ? types : new Set(types);
  let score = 0;
  for (const m of BRAND_MILESTONES) {
    if (set.has(m.type)) score += m.points;
  }
  if (assetCount >= 3) score += 10;
  return Math.min(score, 100);
}

export function inferBrandAssetType(contentType: string, filename: string): BrandAssetType {
  if (contentType.includes('pdf')) return 'brand-book';
  if (
    contentType.startsWith('font/') ||
    /\.(ttf|otf|woff2?)$/i.test(filename)
  ) {
    return 'font';
  }
  if (contentType.startsWith('image/')) return 'logo';
  return 'other';
}
