export type Platform = 'meta' | 'google' | 'tiktok';

export interface MetricValue {
  current: number;
  previous: number;
  change: number;
}

export interface PlatformMetrics {
  platform: Platform;
  spend: MetricValue;
  impressions: MetricValue;
  clicks: MetricValue;
  conversions: MetricValue;
  roas: MetricValue;
  ctr: MetricValue;
}

export interface AggregateMetrics {
  spend: MetricValue;
  impressions: MetricValue;
  clicks: MetricValue;
  conversions: MetricValue;
  roas: MetricValue;
  cpa: MetricValue;
  conversionRate: MetricValue;
  hasData: boolean;
  dateRange: { from: string; to: string };
}

export interface ChartDataPoint {
  date: string;
  meta: number;
  google: number;
  tiktok: number;
}

export interface CampaignRow {
  id: string;
  campaignName: string;
  platform: Platform;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  status: 'active' | 'paused' | 'completed';
  goalImpressions: number | null;
  goalClicks:      number | null;
  goalSpend:       number | null;
}

export interface ActivityItem {
  id: string;
  type: 'campaign' | 'creative' | 'report' | 'brand' | 'system';
  description: string;
  createdAt: string;
}
