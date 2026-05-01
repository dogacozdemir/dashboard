export type BrandAssetType = 'logo' | 'brand-book' | 'font' | 'color-palette' | 'other';

export type BrandIndexingStatus = 'pending' | 'ready' | 'failed' | 'skipped';

export interface BrandAsset {
  id: string;
  name: string;
  type: BrandAssetType;
  url: string;
  fileSize: number | null;
  isPublic: boolean;
  createdAt: string;
  storageKey?:      string | null;
  indexingStatus?:  BrandIndexingStatus;
  indexingError?:   string | null;
  indexedAt?:       string | null;
}
