export type PlatformHealth = 'ok' | 'warn' | 'err';

export type AdminOverviewStats = {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  recentSyncs24h: number;
  totalManagedAssets: number;
  totalCampaignRows: number;
  totalSpend30d: number;
  platformHealth: { meta: PlatformHealth; google: PlatformHealth; tiktok: PlatformHealth };
  healthScoreDisplay: number;
};
