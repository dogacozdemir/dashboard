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
  /** Origin the user started the flow from (their tenant subdomain), so the
   *  callback — served on the fixed OAuth host — can send them back there. */
  origin?: string;
}
