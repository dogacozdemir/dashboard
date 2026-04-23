export type BrandAssetType = 'logo' | 'brand-book' | 'font' | 'color-palette' | 'other';

export interface BrandAsset {
  id: string;
  name: string;
  type: BrandAssetType;
  url: string;
  fileSize: number | null;
  isPublic: boolean;
  createdAt: string;
}
