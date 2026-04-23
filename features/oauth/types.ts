export type AdPlatform = 'meta' | 'google' | 'tiktok';

export interface AdAccount {
  id: string;
  tenantId: string;
  platform: AdPlatform;
  accountId: string;
  accountName: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface OAuthState {
  tenantId: string;
  returnTo: string;
  csrf: string;
}
